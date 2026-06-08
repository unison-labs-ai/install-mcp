import type { ArgumentsCamelCase, Argv } from "yargs"
import process from "node:process"
import { spawn } from "node:child_process"
import { logger } from "../logger"
import { blue, green, red } from "picocolors"
import {
  clientNames,
  readConfig,
  writeConfig,
  getConfigPath,
  getNestedValue,
  setNestedValue,
  type ClientConfig,
} from "../client-config"
import { loadToken, whoami, runAuthFlow } from "../auth"

const UNISON_SERVER_NAME = "unison-brain"
const UNISON_MCP_PACKAGE = "@unisonlabs/mcp"
const UNISON_DEFAULT_API_URL = "https://api.unisonlabs.ai"

const isWindows = process.platform === "win32"

function wrapCommandForPlatform(command: string, args: Array<string>): { command: string; args: Array<string> } {
  if (isWindows) {
    return { command: "cmd", args: ["/c", command, ...args] }
  }
  return { command, args }
}

function setServerConfig(
  config: ClientConfig,
  configKey: string,
  serverName: string,
  serverConfig: ClientConfig,
  client: string
): void {
  let servers = getNestedValue(config, configKey)
  if (!servers) {
    setNestedValue(config, configKey, {})
    servers = getNestedValue(config, configKey)
  }

  if (servers) {
    if (client === "goose") {
      const { env, command, args, ...rest } = serverConfig
      servers[serverName] = {
        name: serverName,
        cmd: command,
        args: args,
        enabled: true,
        envs: env || {},
        type: "stdio",
        timeout: 300,
        ...rest,
      }
    } else if (client === "zed") {
      servers[serverName] = {
        source: "custom",
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env || {},
        ...serverConfig,
      }
    } else if (client === "opencode") {
      const isNpxCommand =
        serverConfig.command === "npx" ||
        (serverConfig.command === "cmd" && serverConfig.args?.[0] === "/c" && serverConfig.args?.[1] === "npx")
      const isNpxMcpRemote = isNpxCommand && serverConfig.args?.includes("mcp-remote@latest")
      if (isNpxMcpRemote) {
        const urlIndex = serverConfig.args.indexOf("mcp-remote@latest") + 1
        const url = serverConfig.args[urlIndex]
        const headers: Record<string, string> = {}

        let i = serverConfig.args.indexOf("--header") + 1
        while (i > 0 && i < serverConfig.args.length) {
          const headerArg = serverConfig.args[i]
          if (headerArg && !headerArg.startsWith("--")) {
            const [key, value] = headerArg.split(":")
            if (key && value) {
              headers[key.trim()] = value.trim()
            }
          }
          i = serverConfig.args.indexOf("--header", i) + 1
        }

        servers[serverName] = {
          type: "remote",
          url: url,
          enabled: true,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        }
      } else {
        servers[serverName] = {
          type: "local",
          command: serverConfig.command,
          args: serverConfig.args || [],
          enabled: true,
          environment: serverConfig.env || {},
        }
      }
    } else {
      servers[serverName] = serverConfig
    }
  }
}

export interface InstallArgv {
  target?: string
  name?: string
  client?: string
  local?: boolean
  yes?: boolean
  token?: string
  apiUrl?: string
  "skip-auth"?: boolean
  header?: Array<string>
  oauth?: "yes" | "no"
  project?: string
  env?: Array<string>
}

export const command = "$0 [target]"
export const describe = "Install an MCP server (default: Unison Memory)"

export function builder(yargs: Argv<InstallArgv>): Argv {
  return yargs
    .positional("target", {
      type: "string",
      description: "Package name, full command, or URL to install (omit to install Unison Memory)",
    })
    .option("name", {
      type: "string",
      description: "Name of the server (auto-extracted from target if not provided)",
    })
    .option("client", {
      type: "string",
      description: "Client to install for (claude-code, cursor, windsurf, etc.)",
    })
    .option("local", {
      type: "boolean",
      description: "Install to the local directory instead of the default location",
      default: false,
    })
    .option("yes", {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompt",
      default: false,
    })
    .option("token", {
      type: "string",
      description: "Unison API token (usk_live_...). Defaults to UNISON_TOKEN env var or ~/.config/unison/config.json",
    })
    .option("api-url", {
      type: "string",
      description: `Unison API base URL (default: ${UNISON_DEFAULT_API_URL})`,
    })
    .option("skip-auth", {
      type: "boolean",
      description: "Skip the Unison auth provisioning step (token must already be set)",
      default: false,
    })
    .option("header", {
      type: "array",
      description: 'Headers to pass to the server (format: "Header: value")',
      default: [],
    })
    .option("project", {
      type: "string",
      description: "Project identifier passed as x-sm-project header for supermemory.ai URLs",
    })
    .option("oauth", {
      type: "string",
      description: "Whether the server uses OAuth authentication (yes/no). If not specified, you will be prompted.",
      choices: ["yes", "no"],
    } as const)
    .option("env", {
      type: "array",
      description: "Environment variables to pass to the server (format: --env KEY VALUE)",
      default: [],
    })
}

export function isUrl(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://")
}

export function isCommand(input: string): boolean {
  return input.includes(" ") || input.startsWith("npx ") || input.startsWith("node ")
}

export function inferNameFromInput(input: string): string {
  if (isUrl(input)) {
    try {
      const url = new URL(input)
      return url.hostname.replace(/\./g, "-")
    } catch {
      const parts = input.split("/")
      return parts[parts.length - 1] || "server"
    }
  } else if (isCommand(input)) {
    const parts = input.split(" ")
    if (parts[0] === "npx" && parts.length > 1) {
      const packageIndex = parts.findIndex((part, index) => index > 0 && !part.startsWith("-"))
      if (packageIndex !== -1) {
        return parts[packageIndex] || "server"
      }
    }
    return parts[0] || "server"
  } else {
    return input
  }
}

export function buildCommand(input: string): string {
  if (isUrl(input)) {
    return input
  } else if (isCommand(input)) {
    return input
  } else {
    return `npx ${input}`
  }
}

function isSupermemoryUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return url.hostname === "api.supermemory.ai"
  } catch {
    return false
  }
}

// Parse environment variables from flat array format [KEY, VALUE, KEY2, VALUE2] into key-value object
function parseEnvVars(envArray?: Array<string>): { [key: string]: string } | undefined {
  if (!envArray || envArray.length === 0) {
    return undefined
  }

  const envObj: { [key: string]: string } = {}
  for (let i = 0; i < envArray.length; i += 2) {
    const key = envArray[i]
    const value = envArray[i + 1]
    if (key && value !== undefined) {
      envObj[key] = value
    }
  }

  return Object.keys(envObj).length > 0 ? envObj : undefined
}

// Run the authentication flow for remote servers before installation.
async function runAuthentication(url: string): Promise<void> {
  logger.info(`Running authentication for ${url}`)
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["-y", "-p", "mcp-remote@latest", "mcp-remote-client", url], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: isWindows,
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Authentication exited with code ${code}`))
      }
    })

    child.on("error", reject)
  })
}

async function resolveToken(argv: ArgumentsCamelCase<InstallArgv>): Promise<string> {
  if (argv.token) return argv.token
  if (process.env.UNISON_TOKEN) return process.env.UNISON_TOKEN
  const saved = loadToken()
  if (saved) {
    try {
      await whoami(saved)
      return saved
    } catch {
      logger.warn("Saved token is invalid or expired. Re-running auth flow.")
    }
  }
  return runAuthFlow()
}

export async function handler(argv: ArgumentsCamelCase<InstallArgv>) {
  if (argv.apiUrl) {
    process.env.UNISON_API_URL = argv.apiUrl
  }

  let client = argv.client
  if (!client || !clientNames.includes(client)) {
    client = (await logger.prompt("Select a client to install for:", {
      type: "select",
      options: clientNames.map((name) => ({ value: name, label: name })),
    })) as string
  }

  const target = argv.target

  // No target → install Unison Memory (default behavior)
  if (!target) {
    await installUnison(argv, client)
    return
  }

  // Generic target path
  await installGeneric(argv, client, target)
}

async function installUnison(argv: ArgumentsCamelCase<InstallArgv>, client: string): Promise<void> {
  let token: string
  if (argv["skip-auth"]) {
    const raw = argv.token ?? process.env.UNISON_TOKEN ?? loadToken()
    if (!raw) {
      logger.error(red("No UNISON_TOKEN found. Remove --skip-auth to run the setup flow, or set UNISON_TOKEN."))
      process.exit(1)
    }
    token = raw
  } else {
    try {
      token = await resolveToken(argv)
    } catch (err) {
      logger.error(red(`Auth failed: ${(err as Error).message}`))
      process.exit(1)
    }
  }

  try {
    const me = await whoami(token)
    logger.info(`Authenticated as ${me.user.email} (tenant: ${me.tenant.name})`)
  } catch {
    logger.warn("Could not verify token with /whoami — continuing anyway.")
  }

  const extraEnvVars = parseEnvVars(argv.env)

  if (client === "warp") {
    logger.log("")
    logger.info("Warp requires a manual installation through their UI.")
    logger.log("  Please copy the following configuration object and add it to your Warp MCP config:\n")

    const warpArgs = ["-y", UNISON_MCP_PACKAGE]
    const warpEnv: Record<string, string> = {
      UNISON_TOKEN: token,
      UNISON_API_URL: process.env.UNISON_API_URL ?? UNISON_DEFAULT_API_URL,
      ...extraEnvVars,
    }

    logger.log(
      JSON.stringify(
        {
          [UNISON_SERVER_NAME]: {
            command: "npx",
            args: warpArgs,
            env: warpEnv,
            working_directory: null,
            start_on_launch: true,
          },
        },
        null,
        2
      )
        .split("\n")
        .map((line) => green(`  ${line}`))
        .join("\n")
    )
    logger.box("Read Warp's documentation at", blue("https://docs.warp.dev/knowledge-and-collaboration/mcp"))
    return
  }

  logger.info(`Installing Unison Memory MCP server for ${client}${argv.local ? " (locally)" : ""}`)

  let ready = argv.yes
  if (!ready) {
    ready = await logger.prompt(green(`Install "${UNISON_SERVER_NAME}" into ${client}?`), {
      type: "confirm",
    })
  }

  if (ready) {
    try {
      const config = readConfig(client, argv.local)
      const configPath = getConfigPath(client, argv.local)
      const configKey = configPath.configKey

      const wrapped = wrapCommandForPlatform("npx", ["-y", UNISON_MCP_PACKAGE])
      const serverEnv: Record<string, string> = {
        UNISON_TOKEN: token,
        UNISON_API_URL: process.env.UNISON_API_URL ?? UNISON_DEFAULT_API_URL,
        ...extraEnvVars,
      }
      const serverConfig: ClientConfig = {
        command: wrapped.command,
        args: wrapped.args,
        env: serverEnv,
      }

      setServerConfig(config, configKey, UNISON_SERVER_NAME, serverConfig, client)
      writeConfig(config, client, argv.local)

      logger.box(green(`Successfully installed "${UNISON_SERVER_NAME}" in ${client}${argv.local ? " (locally)" : ""}`))
      logger.info(`Restart ${client} to activate the Unison Memory MCP server.`)
      logger.info(`\nBrain tools available: brain_search, brain_get, brain_write, brain_record_fact, and more.`)
      logger.info(`Docs: ${blue("https://unisonlabs.ai/docs/mcp")}`)
    } catch (e) {
      logger.error(red((e as Error).message))
    }
  }
}

async function installGeneric(argv: ArgumentsCamelCase<InstallArgv>, client: string, target: string): Promise<void> {
  const name = argv.name || inferNameFromInput(target)
  const cmd = buildCommand(target)
  const envVars = parseEnvVars(argv.env)

  // Resolve supermemory project header when installing its URL
  let projectHeader: string | undefined
  if (isUrl(target) && isSupermemoryUrl(target)) {
    let project = typeof argv.project === "string" ? argv.project : undefined
    if (!project || project.trim() === "") {
      const input = (await logger.prompt(
        'Enter your Supermemory project (no spaces). Press Enter for "default" (you can override per LLM session).',
        { type: "text" }
      )) as string
      project = (input || "").trim() || "default"
    }
    if (/\s/.test(project)) {
      logger.error("Project must not contain spaces. Use hyphens or underscores instead.")
      return
    }
    projectHeader = `x-sm-project:${project}`
  }

  if (client === "warp") {
    logger.log("")
    logger.info("Warp requires a manual installation through their UI.")
    logger.log("  Please copy the following configuration object and add it to your Warp MCP config:\n")

    let warpArgs: Array<string>
    if (isUrl(target)) {
      warpArgs = ["-y", "mcp-remote@latest", target]
      if (argv.header && argv.header.length > 0) {
        for (const header of argv.header) {
          warpArgs.push("--header", header)
        }
      }
      if (projectHeader) {
        warpArgs.push("--header", projectHeader)
      }
    } else {
      warpArgs = cmd.split(" ").slice(1)
    }

    logger.log(
      JSON.stringify(
        {
          [name]: {
            command: isUrl(target) ? "npx" : cmd.split(" ")[0],
            args: warpArgs,
            env: envVars || {},
            working_directory: null,
            start_on_launch: true,
          },
        },
        null,
        2
      )
        .split("\n")
        .map((line) => green(`  ${line}`))
        .join("\n")
    )
    logger.box("Read Warp's documentation at", blue("https://docs.warp.dev/knowledge-and-collaboration/mcp"))
    return
  }

  logger.info(`Installing MCP server "${name}" for ${client}${argv.local ? " (locally)" : ""}`)

  let ready = argv.yes
  if (!ready) {
    ready = await logger.prompt(green(`Install MCP server "${name}" in ${client}?`), {
      type: "confirm",
    })
  }

  if (ready) {
    if (isUrl(target)) {
      let usesOAuth: boolean
      if (argv.oauth === "yes") {
        usesOAuth = true
      } else if (argv.oauth === "no") {
        usesOAuth = false
      } else {
        usesOAuth = await logger.prompt("Does this server use OAuth authentication?", {
          type: "confirm",
        })
      }

      if (usesOAuth) {
        try {
          await runAuthentication(target)
        } catch {
          logger.error("Authentication failed. Use the client to authenticate.")
          return
        }
      }
    }

    try {
      const config = readConfig(client, argv.local)
      const configPath = getConfigPath(client, argv.local)
      const configKey = configPath.configKey

      if (isUrl(target)) {
        const args = ["-y", "mcp-remote@latest", target]
        if (argv.header && argv.header.length > 0) {
          for (const header of argv.header) {
            args.push("--header", header)
          }
        }
        if (projectHeader) {
          args.push("--header", projectHeader)
        }
        const wrapped = wrapCommandForPlatform("npx", args)
        const serverConfig: ClientConfig = {
          command: wrapped.command,
          args: wrapped.args,
        }
        if (envVars) {
          serverConfig.env = envVars
        }
        setServerConfig(config, configKey, name, serverConfig, client)
      } else {
        const cmdParts = cmd.split(" ")
        const wrapped = wrapCommandForPlatform(cmdParts[0] || cmd, cmdParts.slice(1))
        const serverConfig: ClientConfig = {
          command: wrapped.command,
          args: wrapped.args,
        }
        if (envVars) {
          serverConfig.env = envVars
        }
        setServerConfig(config, configKey, name, serverConfig, client)
      }

      writeConfig(config, client, argv.local)
      logger.box(green(`Successfully installed MCP server "${name}" in ${client}${argv.local ? " (locally)" : ""}`))
    } catch (e) {
      logger.error(red((e as Error).message))
    }
  }
}
