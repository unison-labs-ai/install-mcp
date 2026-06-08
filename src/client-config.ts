import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import * as TOML from "@iarna/toml"
import yaml from "js-yaml"
import * as jsonc from "jsonc-parser"

import { logger, verbose } from "./logger"

export interface ClientConfig {
  // biome-ignore lint/suspicious/noExplicitAny: ClientConfig must be flexible to support any client configuration structure
  [key: string]: any
}

interface ClientFileTarget {
  type: "file"
  path: string
  localPath?: string
  configKey: string
  format?: "json" | "yaml" | "toml"
}
type ClientInstallTarget = ClientFileTarget

function getPlatformPaths() {
  const homeDir = os.homedir()
  return {
    win32: {
      baseDir: process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"),
      vscodePath: path.join("Code", "User"),
    },
    darwin: {
      baseDir: path.join(homeDir, "Library", "Application Support"),
      vscodePath: path.join("Code", "User"),
    },
    linux: {
      baseDir: process.env.XDG_CONFIG_HOME || path.join(homeDir, ".config"),
      vscodePath: path.join("Code/User"),
    },
  }
}

function getBasePaths() {
  const platformPaths = getPlatformPaths()
  const platform = process.platform as keyof typeof platformPaths
  const { baseDir, vscodePath } = platformPaths[platform] ?? platformPaths.linux
  const defaultClaudePath = path.join(baseDir, "Claude", "claude_desktop_config.json")
  return { baseDir, vscodePath, defaultClaudePath }
}

function getClientPaths(): { [key: string]: ClientInstallTarget } {
  const { baseDir, vscodePath, defaultClaudePath } = getBasePaths()
  const homeDir = os.homedir()

  return {
    "claude-desktop": { type: "file", path: defaultClaudePath, configKey: "mcpServers" },
    droid: {
      type: "file",
      path: path.join(homeDir, ".factory", "mcp.json"),
      localPath: path.join(process.cwd(), ".factory", "mcp.json"),
      configKey: "mcpServers",
    },
    cline: {
      type: "file",
      path: path.join(baseDir, vscodePath, "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
      configKey: "mcpServers",
    },
    "roo-cline": {
      type: "file",
      path: path.join(
        baseDir,
        vscodePath,
        "globalStorage",
        "rooveterinaryinc.roo-cline",
        "settings",
        "mcp_settings.json"
      ),
      configKey: "mcpServers",
    },
    windsurf: {
      type: "file",
      path: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
      configKey: "mcpServers",
    },
    witsy: { type: "file", path: path.join(baseDir, "Witsy", "settings.json"), configKey: "mcpServers" },
    enconvo: {
      type: "file",
      path: path.join(homeDir, ".config", "enconvo", "mcp_config.json"),
      configKey: "mcpServers",
    },
    cursor: {
      type: "file",
      path: path.join(homeDir, ".cursor", "mcp.json"),
      localPath: path.join(process.cwd(), ".cursor", "mcp.json"),
      configKey: "mcpServers",
    },
    warp: {
      type: "file",
      path: "no-local-config",
      configKey: "mcpServers",
    },
    "gemini-cli": {
      type: "file",
      path: path.join(homeDir, ".gemini", "settings.json"),
      localPath: path.join(process.cwd(), ".gemini", "settings.json"),
      configKey: "mcpServers",
    },
    vscode: {
      type: "file",
      path: path.join(baseDir, vscodePath, "mcp.json"),
      localPath: path.join(process.cwd(), ".vscode", "mcp.json"),
      configKey: "mcpServers",
    },
    "claude-code": {
      type: "file",
      path: path.join(homeDir, ".claude.json"),
      localPath: path.join(process.cwd(), ".mcp.json"),
      configKey: "mcpServers",
    },
    goose: {
      type: "file",
      path: path.join(homeDir, ".config", "goose", "config.yaml"),
      configKey: "extensions",
      format: "yaml",
    },
    zed: {
      type: "file",
      path:
        process.platform === "win32"
          ? path.join(process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"), "Zed", "settings.json")
          : path.join(homeDir, ".config", "zed", "settings.json"),
      configKey: "context_servers",
    },
    codex: {
      type: "file",
      path: path.join(process.env.CODEX_HOME || path.join(homeDir, ".codex"), "config.toml"),
      configKey: "mcp_servers",
      format: "toml",
    },
    opencode: {
      type: "file",
      path: path.join(homeDir, ".config", "opencode", "opencode.json"),
      localPath: path.join(process.cwd(), ".opencode.json"),
      configKey: "mcp",
    },
    aider: {
      type: "file",
      path: path.join(homeDir, ".aider", "mcp.yml"),
      localPath: path.join(process.cwd(), ".aider.mcp.yml"),
      configKey: "servers",
      format: "yaml",
    },
    "aider-desk": {
      type: "file",
      path:
        process.platform === "win32"
          ? path.join(process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"), "aider-desk", "settings.json")
          : process.platform === "darwin"
            ? path.join(homeDir, "Library", "Application Support", "aider-desk", "settings.json")
            : path.join(homeDir, ".config", "aider-desk", "settings.json"),
      configKey: "mcpServers",
    },
  }
}

export const clientNames = [
  "claude-code",
  "cursor",
  "opencode",
  "vscode",
  "codex",
  "gemini-cli",
  "zed",
  "droid",
  "warp",
  // Desktop apps
  "claude-desktop",
  "windsurf",
  // VS Code extensions
  "cline",
  "roo-cline",
  // Other
  "goose",
  "aider",
  "witsy",
  "enconvo",
  "aider-desk",
]

export function getNestedValue(obj: ClientConfig, dotPath: string): ClientConfig | undefined {
  const keys = dotPath.split(".")
  let current: ClientConfig | undefined = obj
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key] as ClientConfig
    } else {
      return undefined
    }
  }
  return current
}

export function setNestedValue(obj: ClientConfig, dotPath: string, value: ClientConfig): void {
  const keys = dotPath.split(".")
  const lastKey = keys.pop()
  if (!lastKey) return
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {}
    return current[key]
  }, obj)
  target[lastKey] = value
}

export function getConfigPath(client?: string, local?: boolean): ClientInstallTarget {
  const normalizedClient = client?.toLowerCase() ?? "claude-desktop"
  verbose(`Getting config path for client: ${normalizedClient}${local ? " (local)" : ""}`)

  const clientPaths = getClientPaths()
  const configTarget = clientPaths[normalizedClient]
  if (!configTarget) {
    const { defaultClaudePath } = getBasePaths()
    return {
      type: "file",
      path: path.join(path.dirname(defaultClaudePath), "..", client ?? "claude-desktop", `${normalizedClient}_config.json`),
      configKey: "mcpServers",
    }
  }

  if (local && configTarget.localPath) {
    verbose(`Using local config path for ${normalizedClient}: ${configTarget.localPath}`)
    return { ...configTarget, path: configTarget.localPath }
  }

  // For OpenCode, prefer .jsonc over .json
  if (normalizedClient === "opencode") {
    const jsoncPath = configTarget.path.replace(".json", ".jsonc")
    if (fs.existsSync(jsoncPath)) {
      verbose(`Found .jsonc file for OpenCode, using: ${jsoncPath}`)
      return { ...configTarget, path: jsoncPath }
    }
  }

  verbose(`Using default config path for ${normalizedClient}: ${configTarget.path}`)
  return configTarget
}

export function readConfig(client: string, local?: boolean): ClientConfig {
  verbose(`Reading config for client: ${client}${local ? " (local)" : ""}`)
  try {
    const configPath = getConfigPath(client, local)
    verbose(`Checking if config file exists at: ${configPath.path}`)

    if (!fs.existsSync(configPath.path)) {
      verbose("Config file not found, returning default empty config")
      const defaultConfig: ClientConfig = {}
      setNestedValue(defaultConfig, configPath.configKey, {})
      return defaultConfig
    }

    verbose("Reading config file content")
    const fileContent = fs.readFileSync(configPath.path, "utf8")

    let rawConfig: ClientConfig
    if (configPath.format === "yaml") {
      rawConfig = (yaml.load(fileContent) as ClientConfig) || {}
    } else if (configPath.format === "toml") {
      rawConfig = TOML.parse(fileContent) as ClientConfig
    } else {
      rawConfig = jsonc.parse(fileContent) as ClientConfig
    }

    verbose(`Config loaded: ${JSON.stringify(rawConfig, null, 2)}`)

    const existingValue = getNestedValue(rawConfig, configPath.configKey)
    if (!existingValue) {
      setNestedValue(rawConfig, configPath.configKey, {})
    }

    return rawConfig
  } catch (error) {
    verbose(`Error reading config: ${error instanceof Error ? error.stack : JSON.stringify(error)}`)
    const configPath = getConfigPath(client, local)
    const defaultConfig: ClientConfig = {}
    setNestedValue(defaultConfig, configPath.configKey, {})
    return defaultConfig
  }
}

export function writeConfig(config: ClientConfig, client?: string, local?: boolean): void {
  verbose(`Writing config for client: ${client ?? "default"}${local ? " (local)" : ""}`)
  const configPath = getConfigPath(client, local)

  const nestedValue = getNestedValue(config, configPath.configKey)
  if (!nestedValue || typeof nestedValue !== "object") {
    verbose(`Invalid ${configPath.configKey} structure in config`)
    throw new Error(`Invalid ${configPath.configKey} structure`)
  }

  writeConfigFile(config, configPath)
}

function detectIndent(text: string): { tabSize: number; insertSpaces: boolean } {
  let result: { tabSize: number; insertSpaces: boolean } | null = null

  jsonc.visit(text, {
    onObjectProperty: (_property, offset, _length, _startLine, startCharacter) => {
      if (result === null && _startLine > 0 && startCharacter > 0) {
        const lineStart = text.lastIndexOf("\n", offset - 1) + 1
        const whitespace = text.slice(lineStart, offset)
        result = {
          tabSize: startCharacter,
          insertSpaces: !whitespace.includes("\t"),
        }
      }
    },
  })

  return result ?? { tabSize: 2, insertSpaces: true }
}

function deepMerge(target: ClientConfig, source: ClientConfig): ClientConfig {
  const result = { ...target }

  for (const key in source) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key] as ClientConfig)
    } else {
      result[key] = source[key]
    }
  }

  return result
}

function writeConfigFile(config: ClientConfig, target: ClientFileTarget): void {
  const configDir = path.dirname(target.path)

  verbose(`Ensuring config directory exists: ${configDir}`)
  if (!fs.existsSync(configDir)) {
    verbose(`Creating directory: ${configDir}`)
    fs.mkdirSync(configDir, { recursive: true })
  }

  let existingConfig: ClientConfig = {}
  setNestedValue(existingConfig, target.configKey, {})

  let originalFileContent = ""
  try {
    if (fs.existsSync(target.path)) {
      verbose("Reading existing config file for merging")
      originalFileContent = fs.readFileSync(target.path, "utf8")

      if (target.format === "yaml") {
        existingConfig = (yaml.load(originalFileContent) as ClientConfig) || {}
      } else if (target.format === "toml") {
        existingConfig = TOML.parse(originalFileContent) as ClientConfig
      } else {
        existingConfig = jsonc.parse(originalFileContent) as ClientConfig
      }

      verbose(`Existing config loaded: ${JSON.stringify(existingConfig, null, 2)}`)
    }
  } catch (error) {
    verbose(`Error reading existing config for merge: ${error instanceof Error ? error.message : String(error)}`)
  }

  verbose("Merging configs")
  const mergedConfig = deepMerge(existingConfig, config)
  verbose(`Merged config: ${JSON.stringify(mergedConfig, null, 2)}`)

  verbose(`Writing config to file: ${target.path}`)

  let configContent: string
  if (target.format === "yaml") {
    configContent = yaml.dump(mergedConfig, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    })
  } else if (target.format === "toml") {
    configContent = TOML.stringify(mergedConfig)
  } else if (originalFileContent) {
    try {
      const configKeyPath = target.configKey.split(".")
      const newValue = getNestedValue(mergedConfig, target.configKey)
      const edits = jsonc.modify(originalFileContent, configKeyPath, newValue, {
        formattingOptions: detectIndent(originalFileContent),
      })
      configContent = jsonc.applyEdits(originalFileContent, edits)
    } catch (error) {
      verbose(`Error applying JSONC edits: ${error instanceof Error ? error.message : String(error)}`)
      verbose("Falling back to JSON.stringify (comments will be lost)")
      configContent = JSON.stringify(mergedConfig, null, 2)
    }
  } else {
    configContent = JSON.stringify(mergedConfig, null, 2)
  }

  fs.writeFileSync(target.path, configContent)
  logger.info(`Config written to: ${target.path}`)
  verbose("Config successfully written")
}
