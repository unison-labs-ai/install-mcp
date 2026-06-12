# Unison Memory — install-mcp

One-command CLI to install the [Unison Memory](https://unisonlabs.ai) MCP server into any AI client — Claude Code, Cursor, Codex, OpenCode, Windsurf, and more. Auth is included: the installer provisions or recovers your `usk_` API key automatically.

## What it does

1. Detects (or asks for) your target client.
2. Provisions a Unison Memory account and mints a `usk_live_...` API key via the machine-auth flow — or recovers your existing key if the email is already registered.
3. Writes the MCP server entry (`@unisonlabs/mcp`) into the client's config file with `UNISON_TOKEN` and `UNISON_API_URL` env vars set.
4. Done — restart your client and the brain tools are available.

## Usage

```bash
npx @unisonlabs/install-mcp
```

The CLI prompts for your client and email, then handles everything else.

### Specify client directly

```bash
npx @unisonlabs/install-mcp --client claude-code
npx @unisonlabs/install-mcp --client cursor
npx @unisonlabs/install-mcp --client windsurf
```

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

## Supported clients

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

## License

MIT
