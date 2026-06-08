# Contributing to install-mcp

Thanks for helping improve `@unisonlabs/install-mcp`.

## Repo layout

```
bin/run.ts          CLI entry point (yargs)
src/
  auth.ts           provision / verify / whoami API calls
  client-config.ts  per-client config detection and file merge
  commands/
    install.ts      the install command
  logger.ts         consola wrapper
  index.ts          package exports
src/*.test.ts       Bun unit tests
```

## Development

Prerequisites: [Bun](https://bun.sh) ≥ 1.0.

```bash
bun install
bun test               # unit tests
bun lint               # Biome lint + format check
bun run lint:fix       # auto-fix lint and format issues
bun run build          # bundle to dist/run.js (CJS via tsup)
```

To run the CLI from source:

```bash
bun run bin/run.ts --help
```

## Before opening a PR

1. `bun lint` and `bun test` must both pass.
2. `bun run build` must succeed (CI checks all three).
3. Keep changes scoped — one logical change per PR.
4. If you add a new client, add a corresponding test case in
   `src/client-config.test.ts`.

## Conventions

- TypeScript + CJS output. Biome formatting (`biome.json`) — run `bun run lint:fix`
  to auto-format.
- The CLI has no client-side auth logic. Never add scope checks, token validation,
  or path allow-lists; those are the server's responsibility.
- `usk_` tokens must never appear in logs or output. Redact with `usk_...` in
  any user-facing message.
- Human-readable progress goes to stderr (via `logger.*`). Machine output goes
  to stdout.

## Reporting bugs / proposing features

Use the issue templates. For security issues, see [`SECURITY.md`](./SECURITY.md) —
do **not** open a public issue.
