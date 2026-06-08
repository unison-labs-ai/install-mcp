import { describe, it, expect } from "bun:test"
import { getNestedValue, setNestedValue, getConfigPath, clientNames } from "./client-config"

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
})
