# AGENTS.md

Guidance for AI agents working with or contributing to `install-mcp`.
Jump to the section that matches your task:

- **Use this installer** — you are an agent helping a user onboard onto Unison Memory →
  [Use this installer](#use-this-installer)
- **Contribute to this repo** — you are modifying this codebase →
  [Working in this repo](#working-in-this-repo)

Follows the [AGENTS.md](https://agents.md/) convention. Human contributors:
see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Use this installer

`@unisonlabs/install-mcp` is a one-command CLI that wires the Unison Memory MCP
server into a user's AI client and provisions an API key (`usk_...`) — so the
user's client gets access to the full Unison brain (search, read, write, entities,
facts) with a single shell command.

### When to use this

Run this when a user wants to add the Unison Memory MCP to their coding agent
(Claude Code, Cursor, Codex, etc.) but has not done so yet, or when they are
switching to a new machine.

### 1. Install

```bash
npx @unisonlabs/install-mcp
```

No global install required — `npx` fetches the package on demand.

For a fully non-interactive install (agent-driven), pass `--client`, `--skip-auth`,
and `--yes`:

```bash
UNISON_TOKEN=usk_live_... UNISON_API_URL=https://brain.unisonlabs.ai \
  npx @unisonlabs/install-mcp --client claude-code --skip-auth --yes
```

### 2. Authenticate

Two paths:

- **Interactive (recommended for first time):** omit `--skip-auth` — the CLI prompts
  for the user's email, provisions an account at `POST /v1/auth/provision`, and walks
  through OTP verification. The resulting `usk_` key is saved to
  `~/.config/unison/config.json` for future invocations.
- **Headless (CI / scripted):** set `UNISON_TOKEN=usk_live_...` (or pass `--token`)
  and `--skip-auth`. The installer skips provisioning and uses the provided token
  directly.

**You cannot mint a `usk_` key yourself** — it must be provisioned by the user's
account (via the interactive flow or the Unison dashboard). The token is never
committed or logged; it exists only in the written client config and
`~/.config/unison/config.json`.

### 3. Verify

After the installer runs, the client config contains:

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

Ask the user to restart their client. The MCP tools (`brain_search`, `brain_get`,
`brain_write`, etc.) become available after restart.

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `UNISON_TOKEN` | `usk_live_...` API key | — (prompted if absent) |
| `UNISON_API_URL` | Base URL of the Unison brain API | `https://brain.unisonlabs.ai` |

### Supported clients

`--client` accepts: `claude-code`, `cursor`, `opencode`, `vscode`, `codex`,
`gemini-cli`, `zed`, `droid`, `warp`, `claude-desktop`, `windsurf`, `cline`,
`roo-cline`, `goose`, `aider`, `witsy`, `enconvo`, `aider-desk`.

---

## Working in this repo

`install-mcp` is a single-package TypeScript CLI built with Bun + tsup. It has
no monorepo structure — everything lives in the root.

### Layout

```
bin/run.ts          CLI entry point (yargs harness)
src/
  auth.ts           provision / verify / whoami API calls
  client-config.ts  per-client config path detection and file merge
  commands/
    install.ts      the default (and only) command
  logger.ts         consola wrapper
  index.ts          package exports
src/*.test.ts       Bun unit tests
tsup.config.ts      builds bin/run.ts → dist/run.js (CJS)
biome.json          lint + format rules
```

### Build, lint, test

Run these before every commit and before opening a PR:

```bash
bun install
bun lint               # Biome lint — `bun run lint:fix` to auto-fix
bun test               # Bun unit tests
bun run build          # tsup → dist/run.js
```

CI runs the same three commands on every pull request to `main`.

### Conventions

- TypeScript + CJS output (tsup targets Node/Bun consumers via `npx`).
- Biome formatting: 2-space indent, double quotes, 120-col line width.
- **No client-side auth enforcement.** The server is the security boundary.
  Never add scope checks, token validation, or path allow-lists in the client.
- **`usk_` tokens are never logged.** The `logger` wrappers must not print
  the token value. Redact with `usk_...` in any user-facing output.
- Output discipline: human-readable progress → stderr (via `logger.*`);
  any machine-readable data would go to stdout (not currently used).

### PRs

- One logical change per PR.
- Update `CHANGELOG.md` (if present) under "Unreleased".
- Never push directly to `main` — open a PR and let CI pass first.
- Security issues: see [`SECURITY.md`](./SECURITY.md) — do not open a public issue.
