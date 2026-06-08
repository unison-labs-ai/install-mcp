import type { ArgumentsCamelCase, Argv } from "yargs"
import process from "node:process"
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

// The MCP server name and command as registered in the Unison brief
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
      // Check for npx directly or wrapped via cmd /c npx (Windows)
      const isNpxCommand =
        serverConfig.command === "npx" ||
        (serverConfig.command === "cmd" && serverConfig.args?.[0] === "/c" && serverConfig.args?.[1] === "npx")
      const isNpxMcpRemote = isNpxCommand && serverConfig.args?.includes("mcp-remote@latest")
      if (isNpxMcpRemote) {
        // For remote MCP servers, OpenCode uses a different structure
        const urlIndex = serverConfig.args.indexOf("mcp-remote@latest") + 1
        const url = serverConfig.args[urlIndex]
        const headers: Record<string, string> = {}

        // Extract headers from args
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
  client?: string
  local?: boolean
  yes?: boolean
  token?: string
  apiUrl?: string
  "skip-auth"?: boolean
  header?: Array<string>
  env?: Array<string>
}

export const command = "$0"
export const describe = "Install the Unison Memory MCP server into your AI client"

export function builder(yargs: Argv<InstallArgv>): Argv {
  return yargs
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
      description: "Skip the auth provisioning step (token must already be set)",
      default: false,
    })
    .option("header", {
      type: "array",
      description: 'Additional headers to pass to the MCP server (format: "Header: value")',
      default: [],
    })
    .option("env", {
      type: "array",
      description: "Additional environment variables to pass to the server (format: --env KEY VALUE)",
      default: [],
    })
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

async function resolveToken(argv: ArgumentsCamelCase<InstallArgv>): Promise<string> {
  // 1. Explicit flag
  if (argv.token) return argv.token

  // 2. Environment variable
  if (process.env.UNISON_TOKEN) return process.env.UNISON_TOKEN

  // 3. Saved credential file
  const saved = loadToken()
  if (saved) {
    // Verify it's still valid
    try {
      await whoami(saved)
      return saved
    } catch {
      logger.warn("Saved token is invalid or expired. Re-running auth flow.")
    }
  }

  // 4. Run interactive provision/verify flow
  return runAuthFlow()
}

export async function handler(argv: ArgumentsCamelCase<InstallArgv>) {
  // Set API URL override if provided
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

  // Resolve the Unison token (provision if needed)
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

  // Confirm with whoami
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
