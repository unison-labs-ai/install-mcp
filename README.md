<div align="center">

<img src="https://raw.githubusercontent.com/unison-labs-ai/unison-brain/main/assets/brain.svg" width="140" />

# install-mcp

**One command. Persistent memory in every AI client you already use.**

Add the [Unison brain](https://unisonlabs.ai) to Claude Code, Cursor, Codex, Windsurf, or any of 17 other clients — auth included, no config editing required.

[![CI](https://github.com/unison-labs-ai/install-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/unison-labs-ai/install-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@unisonlabs/install-mcp?logo=npm&color=cb3837&label=npm)](https://www.npmjs.com/package/@unisonlabs/install-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/unison-labs-ai/install-mcp?style=social)](https://github.com/unison-labs-ai/install-mcp)

[**Quickstart**](#quickstart) • [**Supported clients**](#supported-clients) • [**Flags**](#flags) • [**MCP tools**](#mcp-tools) • [**Auth flow**](#auth-flow)

</div>

---

## Quickstart

```bash
npx @unisonlabs/install-mcp
```

The CLI prompts for your client and email, then handles everything else: provisions your account, mints a `usk_live_...` API key, and writes the MCP server entry into your client's config file. Restart your client — the brain tools are live.

## What it does

1. Detects (or asks for) your target client.
2. Provisions a Unison account and mints a `usk_live_...` API key via the machine-auth flow — or recovers your existing key if the email is already registered.
3. Writes the MCP server entry (`@unisonlabs/mcp`) into the client's config file with `UNISON_TOKEN` and `UNISON_API_URL` env vars set.
4. Done — restart your client and the brain tools are available.

## Supported clients

### Specify client directly

```bash
npx @unisonlabs/install-mcp --client claude-code
npx @unisonlabs/install-mcp --client cursor
npx @unisonlabs/install-mcp --client windsurf
```

| Client | Flag |
|---|---|
| Claude Code | `--client claude-code` |
| Cursor | `--client cursor` |
| OpenCode | `--client opencode` |
| VS Code | `--client vscode` |
| Codex CLI | `--client codex` |
| Gemini CLI | `--client gemini-cli` |
| Zed | `--client zed` |
| Windsurf | `--client windsurf` |
| Claude Desktop | `--client claude-desktop` |
| Cline | `--client cline` |
| Roo-Cline | `--client roo-cline` |
| Goose | `--client goose` |
| Aider | `--client aider` |
| Aider Desk | `--client aider-desk` |
| Witsy | `--client witsy` |
| Enconvo | `--client enconvo` |
| Warp | `--client warp` (prints config to paste) |
| Droid | `--client droid` |

## Flags

### Skip confirmations

```bash
npx @unisonlabs/install-mcp --client claude-code --yes
```

### Install locally (project-scoped config)

```bash
npx @unisonlabs/install-mcp --client cursor --local
```

### Bring your own token

```bash
UNISON_TOKEN=usk_live_... npx @unisonlabs/install-mcp --client claude-code
# or
npx @unisonlabs/install-mcp --client claude-code --token usk_live_...
```

### Custom API URL

```bash
npx @unisonlabs/install-mcp --client cursor --api-url https://brain.unisonlabs.ai
```

### Skip auth (token must already be set)

```bash
npx @unisonlabs/install-mcp --client codex --skip-auth
```

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `UNISON_TOKEN` | Your `usk_live_...` API key | — |
| `UNISON_API_URL` | Unison API base URL | `https://brain.unisonlabs.ai` |

The installed MCP config also sets these env vars so the MCP server can reach the brain.

## Auth flow

The installer uses a headless (no browser) three-step machine-auth flow:

1. `POST /v1/auth/provision` — creates an account and returns an immediately usable `usk_` key plus sends a verification OTP to your email.
2. You enter the OTP.
3. `POST /v1/auth/verify` — makes the account durable (no 72-hour expiry).

If your email is already registered, the installer runs the recovery flow (`/v1/auth/request-key` + `/v1/auth/verify`) to mint a fresh key instead.

The minted token is saved to `~/.config/unison/config.json` and used on subsequent installs without prompting.

## MCP tools

Once installed, the following tools are available inside your client:

**Brain (memory):** `brain_search`, `brain_get`, `brain_list`, `brain_write`, `brain_edit`, `brain_resolve_entity`, `brain_facts_about`, `brain_record_fact`, `brain_status`

**Auth bootstrap (no token required):** `auth_provision`, `auth_verify`, `auth_request_key`

**Web:** `web_search`

**Workspace domains (preview):** `tasks_list`, `tasks_create`, `workspace_team_spaces`, `mail_threads`, `chat_channels`, `crm_search_records`, `calendar_events`, `people_search`

## What gets written to your config

```json
{
  "mcpServers": {
    "unison-brain": {
      "command": "npx",
      "args": ["-y", "@unisonlabs/mcp"],
      "env": {
        "UNISON_TOKEN": "usk_live_...",
        "UNISON_API_URL": "https://brain.unisonlabs.ai"
      }
    }
  }
}
```

## Star history

If this saved you time, a star helps others find it.

[![Star history chart](https://api.star-history.com/svg?repos=unison-labs-ai/install-mcp&type=Date)](https://star-history.com/#unison-labs-ai/install-mcp&Date)

## License

MIT

---

## Part of the Unison Labs constellation

**One brain, every agent.** Every repo below reads from _and writes to_ the same [Unison brain](https://unisonlabs.ai) — no per-tool memory silos.

| Repo | What it does |
|---|---|
| [unison-brain](https://github.com/unison-labs-ai/unison-brain) | CLI · SDK · MCP server — the core |
| [claude-unison](https://github.com/unison-labs-ai/claude-unison) | Memory for Claude Code |
| [cursor-unison](https://github.com/unison-labs-ai/cursor-unison) | Memory for Cursor |
| [codex-unison](https://github.com/unison-labs-ai/codex-unison) | Memory for OpenAI Codex CLI |
| [opencode-unison](https://github.com/unison-labs-ai/opencode-unison) | Memory for OpenCode |
| [openclaw-unison](https://github.com/unison-labs-ai/openclaw-unison) | Memory for OpenClaw |
| [pipecat-unison](https://github.com/unison-labs-ai/pipecat-unison) | Memory for Pipecat voice agents |
| [python-sdk](https://github.com/unison-labs-ai/python-sdk) | Python SDK for the brain |
| **[install-mcp](https://github.com/unison-labs-ai/install-mcp)** | **One-command MCP installer** ← you are here |
| [code-chunk](https://github.com/unison-labs-ai/code-chunk) | AST-aware code chunking |
| [unison-fs](https://github.com/unison-labs-ai/unison-fs) | Mount the brain as a filesystem |
| [backchannel](https://github.com/unison-labs-ai/backchannel) | Async messaging between agents |
| [Unison-evals](https://github.com/unison-labs-ai/Unison-evals) | Open memory benchmark suite |
