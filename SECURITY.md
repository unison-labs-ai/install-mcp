# Security Policy

## Reporting a vulnerability

Please report security issues privately — **do not open a public GitHub issue.**

Email **security@unisonlabs.ai** with:

- a description of the issue and its impact,
- steps to reproduce (a proof-of-concept if you have one),
- any suggested remediation.

We aim to acknowledge within 3 business days and to keep you updated as we
investigate. We will credit reporters who want recognition once a fix ships.

## Scope

This repository is a **CLI installer** — it writes MCP config files and handles
API key provisioning. It holds no secrets of its own and is not a security boundary.
Reports are most useful when they concern:

- how `usk_` tokens are stored on disk (`~/.config/unison/config.json`),
- the provision / verify / request-key auth flow as implemented client-side,
- unsafe config file writes (permissions, path traversal, symlink attacks),
- dependency or supply-chain risks.

Server-side or account-level issues should go to the same address.

## Token handling

The installer stores a bearer token (`usk_...`) in `~/.config/unison/config.json`.
The token is:

- **never logged** to stdout or stderr (only `usk_...` placeholders appear in output),
- **never committed** to any file tracked by git,
- only transmitted to the configured `UNISON_API_URL` host.

If you believe a token has been leaked (e.g. appeared in CI logs), rotate it via
the Unison dashboard or by re-running the installer's provision flow.
