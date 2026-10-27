#!/usr/bin/env node
// Minimal stdio MCP server that wraps `codex exec` (Codex CLI dropped its built-in `mcp-server`).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CODEX_JS =
  process.env.CODEX_JS ||
  join(process.env.APPDATA || "", "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
const TIMEOUT_MS = Number(process.env.CODEX_TIMEOUT_MS || 30 * 60 * 1000);

const TOOLS = [
  {
    name: "codex",
    description:
      "Run OpenAI Codex CLI (codex exec) on a task and return its final answer plus a session_id. " +
      "Pass session_id to continue a previous Codex conversation.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Instructions for Codex." },
        cwd: { type: "string", description: "Absolute working directory for Codex." },
        sandbox: {
          type: "string",
          enum: ["read-only", "workspace-write", "danger-full-access"],
          description: "Sandbox policy for shell commands Codex runs. Default: read-only.",
        },
        model: { type: "string", description: "Optional model override." },
        session_id: { type: "string", description: "Resume this Codex session instead of starting a new one." },
      },
      required: ["prompt"],
    },
  },
];

function runCodex({ prompt, cwd, sandbox = "read-only", model, session_id }) {
  const args = [CODEX_JS, "exec"];
  if (session_id) args.push("resume", session_id);
  args.push("--json", "--skip-git-repo-check", "-c", `sandbox_mode="${sandbox}"`);
  if (model) args.push("-m", model);
  args.push("-");

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: cwd || process.cwd(),
      env: process.env,
      windowsHide: true,
    });
    let threadId = session_id || null;
    const messages = [];
    const errors = [];
    let stderr = "";
    let buf = "";

    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "thread.started") threadId = ev.thread_id;
        else if (ev.type === "item.completed" && ev.item?.type === "agent_message") messages.push(ev.item.text);
        else if (ev.type === "turn.failed" || ev.type === "error") errors.push(ev.error?.message || ev.message || line);
      }
    });
    child.stderr.on("data", (c) => { stderr += c; });

    const timer = setTimeout(() => { child.kill(); errors.push(`Timed out after ${TIMEOUT_MS} ms`); }, TIMEOUT_MS);
    child.on("error", (e) => errors.push(e.message));
    child.on("close", (code) => {
      clearTimeout(timer);
      const answer = messages.length ? messages[messages.length - 1] : "";
      const isError = !answer && (code !== 0 || errors.length > 0);
      let text = answer || "(Codex returned no message)";
      if (isError) text = `Codex failed (exit ${code}).\n${errors.join("\n")}\n${stderr.slice(-2000)}`;
      text += `\n\n[session_id: ${threadId ?? "unknown"}]`;
      resolve({ content: [{ type: "text", text }], isError });
    });

    child.stdin.end(prompt);
  });
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }

async function handle(req) {
  const { id, method, params } = req;
  if (id === undefined) return; // notification
  switch (method) {
    case "initialize":
      return send({ jsonrpc: "2.0", id, result: {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "codex-cli", version: "1.0.0" },
      } });
    case "ping":
      return send({ jsonrpc: "2.0", id, result: {} });
    case "tools/list":
      return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    case "tools/call": {
      if (params?.name !== "codex") {
        return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
      }
      if (!existsSync(CODEX_JS)) {
        return send({ jsonrpc: "2.0", id, result: { isError: true,
          content: [{ type: "text", text: `Codex CLI not found at ${CODEX_JS}. Set CODEX_JS.` }] } });
      }
      return send({ jsonrpc: "2.0", id, result: await runCodex(params.arguments || {}) });
    }
    default:
      return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  handle(req).catch((e) => send({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: String(e) } }));
});
