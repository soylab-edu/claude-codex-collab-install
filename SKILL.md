---
name: claude-codex-collab-install
description: "Claude와 Codex를 MCP·Reason Network로 연결하고, 협업이 끝날 때까지 서로 자동으로 주고받게 하는 설정을 클린 설치한다. 사용자가 '클로드 설치 스킬 사용할게'(Claude 쪽 설치) 또는 '코덱스 설치 스킬 사용할게'(Codex 쪽 설치), '둘 다 설치'라고 하거나, Claude-Codex 협업 연결·자동 협업 루프·reason-network 재설치를 요청할 때 사용한다. Claude Code와 Codex 어느 쪽에서 실행해도 같은 스킬로 동작한다."
---

# Claude ↔ Codex 자동 협업 클린 설치

하나의 스킬로 Claude 쪽과 Codex 쪽 설정을 모두 설치한다. 이 SKILL.md가 있는 폴더를 `<SKILL_DIR>`라고 부른다. 한 PC에서 한 번만 실행하면 되고, Claude Code와 Codex 앱 중 어디서 실행해도 같은 파일을 고친다.

## 이 스킬이 Reason Network 위에 더하는 것

Reason Network는 에이전트끼리 메시지를 주고받는 통로(`list_team`, `send_message`, `check_inbox`, `ask_user`)만 깔아 준다. 받은 에이전트가 답장을 언제까지 이어갈지는 정하지 않는다. 그래서 규칙이 없으면 한 번 답하고 멈추거나 사용자에게 되넘기기 쉽다. 이 스킬은 그 위에 "협업이 끝날 때까지 자동으로 주고받기"를 더한다.

| 더하는 것 | 위치 | 역할 |
| --- | --- | --- |
| 협업 규칙 | Claude `~/.claude/CLAUDE.md`, Codex `~/.codex/AGENTS.md` | `from` 주소로 `reply_to`를 붙여 답하고, 끝날 때까지 계속 주고받고, 끝낼 때 "협업 완료, 회신 불필요"를 밝힌다. 멈추는 조건(상대가 종료를 알림, 결과 합의, 사용자 결정 필요)도 정한다. |
| 승인 창 없애기 | Claude `settings.json` 허용 목록, Codex `default_tools_approval_mode = "approve"` | 답장할 때마다 승인 창이 떠서 흐름이 끊기지 않게 한다. |
| 응답 대기 시간 | Codex `tool_timeout_sec = 660` | 상대의 긴 작업을 기다리다 끊기지 않게 한다. |
| Claude → Codex 직접 호출 | Claude `codex` MCP | Reason Network 없이도 Claude가 Codex에 일을 맡기고, `session_id`로 같은 대화를 이어 간다. |
| 양쪽 스킬 배치 | `~/.claude/skills`, `~/.codex/skills` | 어느 앱에서든 이 스킬을 다시 쓸 수 있다. |

## 0. 사전 준비 (사람이 직접)

자동 협업은 같은 Reason Network 안의 세션끼리만 동작한다. 가입은 브라우저 로그인과 네트워크 선택이 필요해서 사용자가 직접 한다. 사용자가 아직 안 했다면 아래를 안내하고 기다린다.

**1. Reason Network 가입 (공식 한 줄 설치)**

사용자 PC의 터미널에서 한 줄을 실행한다. Reason 앱 전체를 설치할 필요는 없다.

- Windows (어느 셸에서든):
  ```
  powershell -c "irm https://reasonmachines.com/network/install.ps1 | iex"
  ```
- Mac / Linux:
  ```
  curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network
  ```
- 초대 링크를 받았다면 링크 전체를 함께 넘긴다:
  - Windows: `powershell -c "& ([scriptblock]::Create((irm https://reasonmachines.com/network/install.ps1))) '<초대 링크 전체>'"`
  - Mac / Linux: `curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network join '<초대 링크 전체>'`

실행하면 브라우저가 열린다. 사용자가 Google, GitHub, Apple, 이메일 중 하나로 로그인한 뒤, 네트워크 이름을 정해 새로 만들거나 초대받은 네트워크에 들어간다. 브라우저가 없는 환경이면 로그인 링크가 출력되니 그 링크를 사용자에게 보여 준다. 끝나면 출력되는 초대 문구(`Join the Reason Network: …/join/#rn1-…`)를 사용자에게 전해, 함께 협업할 팀원에게 보내게 한다.

**2. Node.js 18 이상**이 있어야 한다. Codex CLI는 없으면 스킬이 설치한다.

설치 스크립트는 시작할 때 이 준비를 확인한다. Reason Network가 없거나 네트워크에 가입돼 있지 않으면 위 한 줄 명령을 안내하고 멈춘다. 그 안내를 사용자에게 그대로 전하고, 가입이 끝나면 다시 실행한다.

## 1. 대상 고르기

사용자 말로 대상을 정한다. 지금 어느 에이전트에서 실행 중인지는 상관없다.

| 사용자 말 | `--target` | 설치 내용 |
| --- | --- | --- |
| "클로드 설치 스킬 사용할게" | `claude` | Reason Network 연결, Claude용 `codex` MCP 서버, 도구 권한, `~/.claude/CLAUDE.md` 협업 규칙 |
| "코덱스 설치 스킬 사용할게" | `codex` | Reason Network 연결(MCP·훅 5개), MCP 타임아웃·자동 승인, `~/.codex/AGENTS.md` 협업 규칙 |
| "둘 다", "양쪽 다" | `both` | 위 두 가지 모두 |

어느 쪽인지 말이 없으면 지금 실행 중인 에이전트 쪽을 고른다(Claude Code면 `claude`, Codex면 `codex`).

## 2. 미리보기(dry-run)

```
node "<SKILL_DIR>/scripts/install.mjs" --target <대상> --dry-run
```

- 사전 점검에서 ✗가 나오면 0단계로 돌아가 사용자에게 안내한다.
- 출력에서 바뀔 파일을 확인한다.

## 3. 설치

사용자가 이 스킬을 쓰겠다고 말한 것 자체가 설치 요청이므로 바로 실행한다.

```
node "<SKILL_DIR>/scripts/install.mjs" --target <대상>
```

기본은 클린 설치다. 기존 연결(`codex`·`reason-network` MCP, reason-network 훅, 이전 규칙 블록)을 지우고 새로 설치한다. 다른 MCP 서버, 다른 훅, 사용자가 직접 쓴 규칙은 건드리지 않는다. 덮어쓰기만 하려면 `--no-clean`을 붙인다.

스크립트가 하는 일:
1. 바꿀 파일을 `~/.claude-codex-collab/backups/<시각>/`에 백업한다.
2. `reason-network setup`으로 Claude·Codex에 Reason Network MCP와 Codex 훅 5개를 연결하고 백그라운드 서비스를 설치한다.
3. Claude 대상이면: 필요할 때 Codex CLI를 설치하고(`npm i -g @openai/codex`), `~/.claude/mcp-servers/codex/server.mjs`를 `codex` MCP로 등록한다(user scope). `mcp__codex__codex`와 `mcp__reason-network__send_message`·`list_team`·`ask_user`를 허용 목록에 넣는다.
4. Codex 대상이면: `[mcp_servers.reason-network]`에 `tool_timeout_sec = 660`과 `default_tools_approval_mode = "approve"`가 있는지 확인한다.
5. 협업 규칙을 마커 블록(`<!-- claude-codex-collab:start/end -->`)으로 넣는다. 다시 실행하면 그 블록만 교체한다.
6. 이 스킬 폴더를 `~/.claude/skills/`와 `~/.codex/skills/` 양쪽에 복사해, 어느 쪽에서든 다시 쓸 수 있게 한다.
7. `reason-network doctor`로 점검한다.

## 4. 마무리 안내

스크립트의 "다음 할 일"을 사용자에게 그대로 전한다. 보통 다음과 같다.
- **Claude:** Claude Code(데스크톱 앱 포함)를 다시 시작한다. `codex login`이 안 돼 있으면 로그인한다.
- **Codex:** Codex 앱을 다시 시작하고, Reason Network 훅 5개 신뢰 창에서 "Trust all and continue"를 고른다.

`doctor` 결과에서 ✓가 아닌 항목과 경고는 숨기지 말고 그대로 보고한다. 실패하면 백업 위치를 알려 준다.

## 되돌리기

- 백업 폴더의 파일을 원래 위치로 복사하면 설치 전 상태로 돌아간다(파일 이름의 `__`는 경로 구분자).
- Reason Network 연결 전체를 빼려면 `reason-network setup --remove`를 실행한다. Cursor 등 다른 에이전트 연결과 서비스도 함께 빠진다.

## 설치 후 협업 방식

설치된 규칙에 따라 양쪽은 이렇게 움직인다.
- 받은 메시지의 `from` 주소로 `reply_to`를 붙여 답한다.
- 협업이 끝나거나 사용자 결정이 필요할 때까지 계속 주고받는다.
- 끝낼 때는 "협업 완료, 회신 불필요"를 밝힌다.

규칙 원문은 `assets/rules/claude-rule.md`와 `assets/rules/codex-rule.md`에 있다.
