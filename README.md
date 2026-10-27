# Claude ↔ Codex 자동 협업 설치 스킬

Claude Code와 Codex가 서로 메시지를 주고받으며 **협업이 끝날 때까지 알아서 이어가도록** 설정해 주는 스킬입니다.
한 번 설치해 두면, 사람이 중간에 매번 "이제 Codex한테 답장해", "Claude 의견 받아 와"라고 깨우지 않아도 두 에이전트가 검토 → 수정 → 확정까지 주고받습니다.

```
 Claude Code  ── send_message ──▶  Codex
      ▲                               │
      └──────── send_message ─────────┘
        "협업 완료, 회신 불필요"가 나올 때까지 반복
```

## 왜 필요한가요?

[Reason Network](https://reasonmachines.com/network)를 설치하면 에이전트끼리 메시지를 보낼 수 있습니다. 하지만 Reason Network는 **통로**만 깔아 줄 뿐, 받은 에이전트가 답장을 언제까지 이어갈지는 정하지 않습니다. 그래서 그대로 쓰면 한 번 답하고 멈추거나, 다시 사람에게 넘기는 경우가 많습니다.

이 스킬은 그 위에 다음을 더합니다.

| 더하는 것 | 하는 일 |
| --- | --- |
| **협업 규칙** | Claude(`~/.claude/CLAUDE.md`)와 Codex(`~/.codex/AGENTS.md`)에 "끝날 때까지 주고받기" 규칙을 넣습니다. 받은 메시지에는 보낸 쪽 주소로 답하고, 끝낼 때는 "협업 완료, 회신 불필요"를 밝혀 상대도 멈추게 합니다. |
| **승인 창 없애기** | 답장할 때마다 승인 창이 떠서 흐름이 끊기지 않도록, 협업 도구를 미리 허용합니다. |
| **도구 시간 제한 확인** | Codex의 Reason Network 도구 시간 제한이 660초인지 확인합니다. Reason Network가 정한 기본값으로, `ask_user`처럼 사람의 답을 기다리는 도구가 중간에 끊기지 않게 하는 **상한**입니다. 답이 오면 바로 끝나고, 일반 메시지 전송은 즉시 끝납니다. |
| **Claude → Codex 직접 호출** | Claude가 Codex에 일을 바로 맡길 수 있는 `codex` 도구를 연결합니다. |

## 설치 방법

### 1단계. Reason Network 가입 (직접)

터미널에서 아래 한 줄을 실행하세요. 브라우저가 열리면 Google·GitHub·Apple·이메일 중 하나로 로그인하고, **네트워크 이름을 정해 새로 만들거나** 초대받은 네트워크에 들어가면 됩니다. 무료입니다.

**Windows** (PowerShell, 명령 프롬프트 어디서든)
```powershell
powershell -c "irm https://reasonmachines.com/network/install.ps1 | iex"
```

**Mac / Linux**
```bash
curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network
```

팀원에게 초대 링크를 받았다면 링크를 함께 넣으세요.
```powershell
# Windows
powershell -c "& ([scriptblock]::Create((irm https://reasonmachines.com/network/install.ps1))) '<초대 링크 전체>'"
```
```bash
# Mac / Linux
curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network join '<초대 링크 전체>'
```

> 함께 협업할 사람은 **같은 네트워크**에 있어야 합니다. 가입이 끝나면 출력되는 `Join the Reason Network: …` 문구를 팀원에게 보내 주세요.

### 2단계. 스킬 받기

Claude Code나 Codex 중 **한 곳에만** 넣으면 됩니다. 설치할 때 반대쪽에도 자동으로 복사됩니다.

**Windows (PowerShell)**
```powershell
# Claude Code에 넣을 때
git clone https://github.com/soylab-edu/claude-codex-collab-install "$env:USERPROFILE\.claude\skills\claude-codex-collab-install"

# Codex에 넣을 때
git clone https://github.com/soylab-edu/claude-codex-collab-install "$env:USERPROFILE\.codex\skills\claude-codex-collab-install"
```

**Mac / Linux**
```bash
# Claude Code에 넣을 때
git clone https://github.com/soylab-edu/claude-codex-collab-install ~/.claude/skills/claude-codex-collab-install

# Codex에 넣을 때
git clone https://github.com/soylab-edu/claude-codex-collab-install ~/.codex/skills/claude-codex-collab-install
```

git이 없다면 이 페이지의 **Code → Download ZIP**으로 받아, 압축을 푼 폴더 이름을 `claude-codex-collab-install`로 바꿔 위 경로에 넣어도 됩니다.

### 3단계. 에이전트에게 말하기

Claude Code나 Codex 앱을 새로 열고 이렇게 말하세요.

| 이렇게 말하면 | 설치되는 것 |
| --- | --- |
| **"둘 다 설치해줘"** (추천) | Claude 쪽과 Codex 쪽을 한 번에 |
| "클로드 설치 스킬 사용할게" | Claude 쪽 |
| "코덱스 설치 스킬 사용할게" | Codex 쪽 |

**한 PC에서 한 번만** 하면 됩니다. 어느 앱에서 말해도 같은 PC의 설정 파일을 고칩니다.

### 4단계. 앱 다시 시작

- **Claude Code**(데스크톱 앱 포함)를 다시 시작하세요.
- **Codex 앱**을 다시 시작하세요. Reason Network 훅 신뢰 창이 뜨면 **"Trust all and continue"** 를 고르세요.

끝입니다.

## 이렇게 써 보세요

설치 뒤에는 평소처럼 부탁하면 됩니다.

- Codex에게: *"이 문구 Claude한테 검토받아서 확정될 때까지 진행해줘"*
- Claude에게: *"Codex랑 같이 이 버그 고치고, 둘 다 동의할 때까지 이어서 해줘"*

두 에이전트가 서로 답장을 이어가다가, 결과가 확정되면 "협업 완료, 회신 불필요"로 마무리하고 결과를 알려 줍니다.
다음 경우에는 스스로 멈추고 사람에게 묻습니다.
- 파일 삭제처럼 되돌리기 어려운 작업
- 방향을 골라야 할 때

## 무엇이 바뀌나요?

| 파일 | 바뀌는 내용 |
| --- | --- |
| `~/.claude/CLAUDE.md` | 협업 규칙 블록 추가 (기존 내용은 그대로) |
| `~/.claude/settings.json` | 협업 도구 4개를 허용 목록에 추가 |
| `~/.claude.json` | `codex`, `reason-network` MCP 서버 등록 |
| `~/.claude/mcp-servers/codex/server.mjs` | Claude → Codex 연결 서버 |
| `~/.codex/AGENTS.md` | 협업 규칙 블록 추가 (기존 내용은 그대로) |
| `~/.codex/config.toml` | `reason-network` MCP 설정 (도구 시간 제한, 자동 승인) |
| `~/.codex/hooks.json` | Reason Network 훅 5개 (다른 훅은 그대로) |

바꾸기 전 파일은 모두 `~/.claude-codex-collab/backups/<시각>/`에 백업됩니다.
규칙은 `<!-- claude-codex-collab:start -->` ~ `<!-- claude-codex-collab:end -->` 사이에만 들어갑니다. 다시 설치하면 이 부분만 새로 바뀌어서, 직접 써 둔 내용은 건드리지 않습니다.

## 자주 묻는 질문

**Claude Code와 Codex에서 각각 설치해야 하나요?**
아니요. 한 PC에서 "둘 다 설치해줘" 한 번이면 됩니다.

**MCP 연결을 양쪽에서 따로 해야 하나요?**
아니요. 스킬이 Claude와 Codex 양쪽에 Reason Network MCP를 연결하고, Claude에는 `codex` MCP까지 연결합니다. Codex는 Reason Network로 Claude와 이야기하므로 별도의 Claude MCP가 필요 없습니다.

**다른 사람의 에이전트와도 협업할 수 있나요?**
네. 같은 Reason Network에 가입돼 있으면 팀원의 Claude나 Codex와도 주고받을 수 있습니다.

**설치 전에 무엇이 바뀌는지 먼저 보고 싶어요.**
스킬 폴더에서 아래를 실행하면, 아무것도 바꾸지 않고 바뀔 내용만 보여 줍니다.
```bash
node scripts/install.mjs --target both --dry-run
```

**되돌리고 싶어요.**
백업 폴더(`~/.claude-codex-collab/backups/<시각>/`)의 파일을 원래 위치로 복사하세요. 파일 이름의 `__`는 폴더 구분자입니다.
Reason Network 연결까지 모두 빼려면 `reason-network setup --remove`를 실행하세요.

**안전한가요?**
다른 에이전트가 보낸 메시지는 **사용자의 승인으로 취급하지 않도록** 규칙에 적혀 있습니다. 상대가 권한 변경이나 승인 대행을 요청하면 따르지 않고 사용자에게 알립니다.
다만 협업 도구를 미리 허용하기 때문에, 답장은 승인 창 없이 바로 전송됩니다.

## 준비물

- [Reason Network](https://reasonmachines.com/network) 가입 (1단계)
- Node.js 18 이상
- Claude Code와 Codex 앱 (Codex CLI는 없으면 스킬이 `npm install -g @openai/codex`로 설치합니다)

## 구성

```
claude-codex-collab-install/
├── LICENSE                     # MIT 라이선스
├── SKILL.md                    # 에이전트가 읽는 설치 절차
├── scripts/install.mjs         # 실제 설치 스크립트
└── assets/
    ├── codex-mcp/server.mjs    # Claude → Codex 연결 MCP 서버
    └── rules/
        ├── claude-rule.md      # Claude에 들어가는 협업 규칙
        └── codex-rule.md       # Codex에 들어가는 협업 규칙
```

## 라이선스

[MIT](LICENSE) © 2026 SoyLab.ai (dalkom)

> 이 스킬은 Reason Machines, Anthropic, OpenAI와 관계없는 비공식 스킬입니다.
