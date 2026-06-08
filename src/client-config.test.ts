import { describe, it, expect } from "bun:test"
import { getNestedValue, setNestedValue, getConfigPath, clientNames } from "./client-config"
import { isUrl, isCommand, inferNameFromInput, buildCommand } from "./commands/install"

describe("getNestedValue", () => {
  it("returns top-level value", () => {
    const obj = { mcpServers: { foo: 1 } }
    expect(getNestedValue(obj, "mcpServers")).toEqual({ foo: 1 })
  })

  it("returns nested value via dot notation", () => {
    const obj = { tools: { mcpServers: { bar: 2 } } }
    expect(getNestedValue(obj, "tools.mcpServers")).toEqual({ bar: 2 })
  })

  it("returns undefined for missing key", () => {
    const obj = {}
    expect(getNestedValue(obj, "missing")).toBeUndefined()
  })
})

describe("setNestedValue", () => {
  it("sets top-level key", () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, "mcpServers", { x: 1 })
    expect(obj.mcpServers).toEqual({ x: 1 })
  })

  it("creates intermediate objects for nested path", () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, "tools.mcpServers", { y: 2 })
    expect((obj.tools as Record<string, unknown>)?.mcpServers).toEqual({ y: 2 })
  })
})

describe("getConfigPath", () => {
  it("returns mcpServers configKey for claude-code", () => {
    const result = getConfigPath("claude-code")
    expect(result.configKey).toBe("mcpServers")
  })

  it("returns mcp_servers configKey for codex", () => {
    const result = getConfigPath("codex")
    expect(result.configKey).toBe("mcp_servers")
  })

  it("returns toml format for codex", () => {
    const result = getConfigPath("codex")
    expect(result.format).toBe("toml")
  })

  it("returns local path when local=true for cursor", () => {
    const global = getConfigPath("cursor", false)
    const local = getConfigPath("cursor", true)
    expect(local.path).not.toBe(global.path)
  })
})

describe("clientNames", () => {
  it("includes all major clients", () => {
    expect(clientNames).toContain("claude-code")
    expect(clientNames).toContain("cursor")
    expect(clientNames).toContain("windsurf")
    expect(clientNames).toContain("codex")
    expect(clientNames).toContain("opencode")
  })

  it("includes nanobot", () => {
    expect(clientNames).toContain("nanobot")
  })

  it("has at least 19 clients", () => {
    expect(clientNames.length).toBeGreaterThanOrEqual(19)
  })
})

describe("nanobot config", () => {
  it("uses tools.mcpServers configKey", () => {
    const result = getConfigPath("nanobot")
    expect(result.configKey).toBe("tools.mcpServers")
  })

  it("uses .nanobot/config.json path", () => {
    const result = getConfigPath("nanobot")
    expect(result.path).toContain(".nanobot")
    expect(result.path).toContain("config.json")
  })

  it("returns local path when local=true", () => {
    const global = getConfigPath("nanobot", false)
    const local = getConfigPath("nanobot", true)
    expect(local.path).not.toBe(global.path)
  })
})

describe("isUrl", () => {
  it("returns true for https URLs", () => {
    expect(isUrl("https://example.com/mcp")).toBe(true)
  })

  it("returns true for http URLs", () => {
    expect(isUrl("http://localhost:3000")).toBe(true)
  })

  it("returns false for package names", () => {
    expect(isUrl("@myorg/mcp-server")).toBe(false)
  })

  it("returns false for commands", () => {
    expect(isUrl("npx my-mcp-server")).toBe(false)
  })
})

describe("isCommand", () => {
  it("returns true for strings containing a space", () => {
    expect(isCommand("node server.js")).toBe(true)
  })

  it("returns true for npx-prefixed strings", () => {
    expect(isCommand("npx @org/mcp")).toBe(true)
  })

  it("returns false for bare package names", () => {
    expect(isCommand("@org/mcp-server")).toBe(false)
  })
})

describe("inferNameFromInput", () => {
  it("infers name from URL hostname", () => {
    expect(inferNameFromInput("https://example.com/path")).toBe("example-com")
  })

  it("infers name from npx command", () => {
    expect(inferNameFromInput("npx @org/mcp-server")).toBe("@org/mcp-server")
  })

  it("returns package name as-is for simple package", () => {
    expect(inferNameFromInput("my-mcp-server")).toBe("my-mcp-server")
  })
})

describe("buildCommand", () => {
  it("wraps plain package name with npx", () => {
    expect(buildCommand("my-mcp-server")).toBe("npx my-mcp-server")
  })

  it("returns full command unchanged", () => {
    expect(buildCommand("npx -y my-server")).toBe("npx -y my-server")
  })

  it("returns URL unchanged", () => {
    expect(buildCommand("https://example.com/mcp")).toBe("https://example.com/mcp")
  })
})
