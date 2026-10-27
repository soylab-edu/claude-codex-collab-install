#!/usr/bin/env node
// Clean-installs the Claude <-> Codex auto-collaboration setup:
//   Reason Network wiring (MCP + Codex hooks), the Claude-side `codex` MCP server,
//   tool permissions, and the "keep going until the collaboration is done" rules.
//
// Usage: node install.mjs --target claude|codex|both [--dry-run] [--no-clean] [--no-service]
import { spawnSync } from "node:child_process";
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "claude-codex-collab-install";
const MARK_START = "<!-- claude-codex-collab:start -->";
const MARK_END = "<!-- claude-codex-collab:end -->";
const CLAUDE_ALLOW = [
  "mcp__codex__codex",
  "mcp__reason-network__send_message",
  "mcp__reason-network__list_team",
  "mcp__reason-network__ask_user",
];

const IS_WIN = process.platform === "win32";
const HOME = homedir();
const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_DIR = join(HOME, ".claude-codex-collab", "backups", STAMP);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const TARGET = opt("--target") || "both";
const DRY = flag("--dry-run");
const CLEAN = !flag("--no-clean");
const SETUP_ARGS = flag("--no-service") ? ["setup", "--no-service"] : ["setup"];

const JOIN_HELP =
  "    Reason Network 공식 설치 명령 한 줄로 가입해 주세요 (브라우저에서 로그인하고 네트워크를 만들거나 들어가요):\n" +
  (process.platform === "win32"
    ? '      powershell -c "irm https://reasonmachines.com/network/install.ps1 | iex"\n' +
      "    초대 링크가 있으면:\n" +
      "      powershell -c \"& ([scriptblock]::Create((irm https://reasonmachines.com/network/install.ps1))) '<초대 링크 전체>'\"\n"
    : "      curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network\n" +
      "    초대 링크가 있으면:\n" +
      "      curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network join '<초대 링크 전체>'\n") +
  "    가입한 뒤 이 스킬을 다시 실행해 주세요.";

const warnings = [];
const nextSteps = [];
const log = (msg) => console.log(msg);
const step = (msg) => console.log(`\n▶ ${msg}`);
const warn = (msg) => { warnings.push(msg); console.log(`  ⚠ ${msg}`); };
const act = (msg, fn) => { console.log(`  ${DRY ? "[dry-run] " : ""}${msg}`); if (!DRY) return fn(); };

if (!["claude", "codex", "both"].includes(TARGET)) {
  console.error(`--target 값은 claude | codex | both 중 하나여야 해요 (받은 값: ${TARGET})`);
  process.exit(1);
}

// ---------- helpers ----------

function quote(a) { return /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a; }

function run(cmd, args, { allowFail = false, env } = {}) {
  const opts = { encoding: "utf8", env: { ...process.env, ...env }, windowsHide: true };
  let r = spawnSync(cmd, args, opts);
  // npm / npm-installed CLIs are .cmd shims on Windows and need a shell.
  if (r.error && IS_WIN) r = spawnSync([cmd, ...args].map(quote).join(" "), { ...opts, shell: true });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (!allowFail && (r.error || r.status !== 0)) {
    throw new Error(`${cmd} ${args.join(" ")} 실패 (exit ${r.status}): ${r.error?.message || out}`);
  }
  return { ok: !r.error && r.status === 0, out };
}

function readText(p) { return existsSync(p) ? readFileSync(p, "utf8") : ""; }
function writeText(p, text) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text, "utf8"); }

function backup(p) {
  if (!existsSync(p) || DRY) return;
  const dest = join(BACKUP_DIR, p.replace(HOME, "").replace(/^[\\/]+/, "").replace(/[\\/]/g, "__"));
  mkdirSync(BACKUP_DIR, { recursive: true });
  copyFileSync(p, dest);
  log(`  백업: ${p} → ${dest}`);
}

function upsertMarkedBlock(file, body) {
  const block = `${MARK_START}\n${body.trim()}\n${MARK_END}`;
  const text = readText(file);
  const s = text.indexOf(MARK_START);
  const e = text.indexOf(MARK_END);
  let next;
  if (s >= 0 && e > s) next = text.slice(0, s) + block + text.slice(e + MARK_END.length);
  else next = (text.trim() ? text.replace(/\s*$/, "\n\n") : "") + block + "\n";
  act(`${file}에 협업 규칙 블록 ${s >= 0 ? "교체" : "추가"}`, () => writeText(file, next));
}

function findReasonBin() {
  const candidates = [
    process.env.REASON_NETWORK_BIN,
    join(HOME, ".reason", "bin", IS_WIN ? "reason-network.exe" : "reason-network"),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  const which = run(IS_WIN ? "where" : "which", ["reason-network"], { allowFail: true });
  if (which.ok && which.out) return which.out.split(/\r?\n/)[0].trim();
  return null;
}

// ---------- shared ----------

step("사전 점검");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 18) { console.error(`Node 18 이상이 필요해요 (현재 ${process.versions.node}).`); process.exit(2); }
log(`  Node ${process.versions.node} ✓`);
const REASON = findReasonBin();
if (!REASON) {
  console.error(
    "  ✗ Reason Network(reason-network)를 찾지 못했어요.\n" + JOIN_HELP +
    "\n    (이미 다른 위치에 설치했다면 REASON_NETWORK_BIN 환경 변수로 경로를 알려 주세요.)",
  );
  process.exit(2);
}
log(`  Reason Network: ${REASON} ✓`);
// Auto-collaboration only works between members of the same Reason Network team,
// so joining one is the first step and must be done by the person, not this script.
if (/not in a team/i.test(run(REASON, ["doctor"], { allowFail: true }).out)) {
  console.error(
    "  ✗ 아직 Reason Network에 가입돼 있지 않아요. 자동 협업은 같은 네트워크 안에서만 동작해요.\n" + JOIN_HELP,
  );
  if (!DRY) process.exit(3);
  warn("팀 미가입 상태 (dry-run이라 계속 진행)");
} else log("  Reason Network 팀 가입 ✓");
log(`  대상: ${TARGET}${DRY ? " (dry-run: 아무것도 바꾸지 않음)" : ""}${CLEAN ? " · 클린 설치" : ""}`);

let reasonSetupDone = false;
function reasonSetup() {
  if (reasonSetupDone) return;
  reasonSetupDone = true;
  step("Reason Network 연결(setup)");
  if (DRY) { log(run(REASON, [...SETUP_ARGS, "--dry-run"], { allowFail: true }).out.replace(/^/gm, "  ")); return; }
  log(run(REASON, SETUP_ARGS).out.replace(/^/gm, "  "));
}

// ---------- Claude side ----------

function findCodexJs() {
  if (process.env.CODEX_JS && existsSync(process.env.CODEX_JS)) return process.env.CODEX_JS;
  const root = run("npm", ["root", "-g"], { allowFail: true });
  if (!root.ok) return null;
  const p = join(root.out.split(/\r?\n/).pop().trim(), "@openai", "codex", "bin", "codex.js");
  return existsSync(p) ? p : null;
}

const settingsPath = join(HOME, ".claude", "settings.json");
const claudeMd = join(HOME, ".claude", "CLAUDE.md");
const serverDir = join(HOME, ".claude", "mcp-servers", "codex");
const serverPath = join(serverDir, "server.mjs");
let claudeReady = false;

function cleanClaude() {
  step("Claude 쪽 백업");
  [settingsPath, claudeMd, join(HOME, ".claude.json"), serverPath].forEach(backup);

  if (!run("claude", ["--version"], { allowFail: true }).ok) {
    warn("claude CLI를 찾지 못했어요. Claude Code를 설치한 뒤 다시 실행해 주세요.");
    return;
  }
  claudeReady = true;

  if (CLEAN) {
    step("Claude 쪽 기존 연결 정리");
    act("codex MCP 제거", () => run("claude", ["mcp", "remove", "codex", "-s", "user"], { allowFail: true }));
    act("reason-network MCP 제거 (setup이 다시 추가)", () =>
      run("claude", ["mcp", "remove", "reason-network", "-s", "user"], { allowFail: true }));
    act(`${serverDir} 삭제`, () => rmSync(serverDir, { recursive: true, force: true }));
  }

}

function finishClaude() {
  if (!claudeReady) return;
  step("Codex CLI 확인");
  let codexJs = findCodexJs();
  if (!codexJs) {
    act("Codex CLI 설치: npm install -g @openai/codex", () => run("npm", ["install", "-g", "@openai/codex"]));
    codexJs = DRY ? "(설치 후 경로)" : findCodexJs();
  }
  if (!codexJs) { warn("Codex CLI(codex.js)를 찾지 못해 codex MCP를 건너뛰었어요. `codex login`까지 마친 뒤 다시 실행해 주세요."); }
  else {
    log(`  codex.js: ${codexJs}`);
    step("Claude에 codex MCP 서버 등록");
    act(`server.mjs 복사 → ${serverPath}`, () => {
      mkdirSync(serverDir, { recursive: true });
      copyFileSync(join(SKILL_DIR, "assets", "codex-mcp", "server.mjs"), serverPath);
    });
    act("claude mcp add codex (user scope)", () => {
      run("claude", ["mcp", "remove", "codex", "-s", "user"], { allowFail: true });
      run("claude", ["mcp", "add", "codex", "-s", "user", "-e", `CODEX_JS=${codexJs}`, "--", "node", serverPath]);
    });
    if (!run("codex", ["login", "status"], { allowFail: true }).ok) {
      nextSteps.push("터미널에서 `codex login`으로 Codex CLI에 로그인하세요 (claude → codex 직접 호출에 필요).");
    }
  }

  step("Claude 도구 권한 허용 목록");
  const settings = existsSync(settingsPath) ? JSON.parse(readText(settingsPath) || "{}") : {};
  settings.permissions ??= {};
  const allow = new Set(settings.permissions.allow || []);
  const added = CLAUDE_ALLOW.filter((t) => !allow.has(t));
  CLAUDE_ALLOW.forEach((t) => allow.add(t));
  settings.permissions.allow = [...allow];
  if (added.length) act(`허용 추가: ${added.join(", ")}`, () => writeText(settingsPath, JSON.stringify(settings, null, 2) + "\n"));
  else log("  이미 모두 허용돼 있어요.");

  step("Claude 협업 규칙(CLAUDE.md)");
  upsertMarkedBlock(claudeMd, readText(join(SKILL_DIR, "assets", "rules", "claude-rule.md")));

  nextSteps.push("Claude Code(데스크톱 앱 포함)를 다시 시작해 새 MCP 서버와 규칙을 불러오세요.");
}

// ---------- Codex side ----------

const REASON_TABLE = /^\s*\[\s*mcp_servers\.(?:"reason-network"|'reason-network'|reason-network)(?:\.[^\]]*)?\s*\]\s*$/;

function removeReasonTable(text) {
  const out = [];
  let skipping = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) skipping = REASON_TABLE.test(line);
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function ensureReasonKeys(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*\[\s*mcp_servers\.(?:"reason-network"|'reason-network'|reason-network)\s*\]\s*$/.test(l));
  if (start < 0) return { text, missing: ["[mcp_servers.reason-network] 테이블"] };
  let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n");
  const want = [
    ["tool_timeout_sec", "tool_timeout_sec = 660"],
    ["default_tools_approval_mode", 'default_tools_approval_mode = "approve"'],
  ].filter(([k]) => !new RegExp(`^\\s*${k}\\s*=`, "m").test(body));
  let insertAt = end;
  while (insertAt > start + 1 && !lines[insertAt - 1].trim()) insertAt--;
  lines.splice(insertAt, 0, ...want.map(([, l]) => l));
  return { text: lines.join("\n"), missing: [], added: want.map(([k]) => k) };
}

function stripReasonHooks(json) {
  const hooks = json.hooks || {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = (groups || [])
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || "").includes("reason-network")) }))
      .filter((g) => g.hooks.length);
    if (kept.length) hooks[event] = kept; else delete hooks[event];
  }
  json.hooks = hooks;
  return json;
}

const CODEX_HOME = process.env.CODEX_HOME || join(HOME, ".codex");
const configPath = join(CODEX_HOME, "config.toml");
const hooksPath = join(CODEX_HOME, "hooks.json");
const agentsMd = join(CODEX_HOME, "AGENTS.md");

function cleanCodex() {
  step("Codex 쪽 백업");
  [configPath, hooksPath, agentsMd].forEach(backup);

  if (CLEAN) {
    step("Codex 쪽 기존 연결 정리");
    const toml = readText(configPath);
    if (toml.split(/\r?\n/).some((l) => REASON_TABLE.test(l))) {
      act("config.toml에서 [mcp_servers.reason-network] 제거 (setup이 다시 추가)", () =>
        writeText(configPath, removeReasonTable(toml)));
    }
    if (existsSync(hooksPath)) {
      let hooks;
      try { hooks = JSON.parse(readText(hooksPath) || "{}"); }
      catch (e) { warn(`hooks.json이 올바른 JSON이 아니라 정리를 건너뛰었어요(${e.message}). 백업을 확인하고 고친 뒤 다시 실행해 주세요.`); }
      if (hooks) act("hooks.json에서 reason-network 훅 제거 (setup이 다시 추가)", () =>
        writeText(hooksPath, JSON.stringify(stripReasonHooks(hooks), null, 2) + "\n"));
    }
  }
}

function finishCodex() {
  step("Codex MCP 설정 보강");
  if (DRY) log("  [dry-run] setup 뒤 reason-network에 tool_timeout_sec=660, default_tools_approval_mode=\"approve\" 확인");
  else {
    const r = ensureReasonKeys(readText(configPath));
    if (r.missing.length) warn(`config.toml에 ${r.missing.join(", ")}이(가) 없어요. setup 출력을 확인해 주세요.`);
    else if (r.added.length) { writeText(configPath, r.text); log(`  추가: ${r.added.join(", ")}`); }
    else log("  이미 설정돼 있어요.");
  }

  step("Codex 협업 규칙(AGENTS.md)");
  upsertMarkedBlock(agentsMd, readText(join(SKILL_DIR, "assets", "rules", "codex-rule.md")));

  nextSteps.push('Codex 앱을 다시 시작하고, Reason Network 훅 5개 신뢰 창이 뜨면 "Trust all and continue"를 고르세요.');
}

// ---------- skill sync ----------

function syncSkill() {
  step("스킬을 Claude·Codex 양쪽에 배치");
  for (const root of [join(HOME, ".claude", "skills"), join(CODEX_HOME, "skills")]) {
    const dest = join(root, SKILL_NAME);
    if (resolve(dest).toLowerCase() === SKILL_DIR.toLowerCase()) { log(`  ${dest} (현재 위치) ✓`); continue; }
    act(`복사 → ${dest}`, () => {
      rmSync(dest, { recursive: true, force: true });
      // Skip git metadata when the skill was installed with `git clone`.
      cpSync(SKILL_DIR, dest, { recursive: true, filter: (src) => !/[\\/]\.git([\\/]|$)/.test(src) });
    });
  }
}

// ---------- main ----------

try {
  // Clean every target first, then run `reason-network setup` once (it wires all agents),
  // so a later cleanup can't undo what setup just added.
  const doClaude = TARGET === "claude" || TARGET === "both";
  const doCodex = TARGET === "codex" || TARGET === "both";
  if (doClaude) cleanClaude();
  if (doCodex) cleanCodex();
  reasonSetup();
  if (doClaude) finishClaude();
  if (doCodex) finishCodex();
  syncSkill();

  step("점검(doctor)");
  log(run(REASON, ["doctor"], { allowFail: true }).out.replace(/^/gm, "  "));

  console.log("\n==== 결과 ====");
  console.log(DRY ? "dry-run 완료 (변경 없음)" : `설치 완료${existsSync(BACKUP_DIR) ? ` · 백업: ${BACKUP_DIR}` : ""}`);
  if (warnings.length) console.log("\n경고:\n" + warnings.map((w) => `- ${w}`).join("\n"));
  if (nextSteps.length) console.log("\n다음 할 일:\n" + nextSteps.map((s) => `- ${s}`).join("\n"));
} catch (e) {
  console.error(`\n✗ 설치 중단: ${e.message}`);
  if (existsSync(BACKUP_DIR)) console.error(`  백업은 ${BACKUP_DIR}에 있어요.`);
  process.exit(1);
}
