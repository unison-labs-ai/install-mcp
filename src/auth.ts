import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { logger } from "./logger"

const UNISON_CONFIG_DIR = path.join(os.homedir(), ".config", "unison")
const UNISON_CONFIG_FILE = path.join(UNISON_CONFIG_DIR, "config.json")

const DEFAULT_API_URL = "https://brain.unisonlabs.ai"

export interface UnisonConfig {
  token: string
  email?: string
  tenantId?: string
}

export interface ProvisionResult {
  apiKey: string
  tenantId: string
  status: string
  emailSent: boolean
  message: string
}

export interface VerifyResult {
  verified: boolean
  apiKey?: string
  tenantId: string
}

export interface WhoamiResult {
  user: { id: string; email: string }
  tenant: { id: string; name: string; verified: boolean }
  scopes: Array<string>
}

function getApiUrl(): string {
  const url = process.env.UNISON_API_URL ?? DEFAULT_API_URL
  return url.replace(/\/$/, "")
}

function getToken(): string | undefined {
  // Env var takes precedence over credential file
  if (process.env.UNISON_TOKEN) {
    return process.env.UNISON_TOKEN
  }
  try {
    if (fs.existsSync(UNISON_CONFIG_FILE)) {
      const raw = fs.readFileSync(UNISON_CONFIG_FILE, "utf8")
      const config = JSON.parse(raw) as UnisonConfig
      return config.token
    }
  } catch {
    // ignore
  }
  return undefined
}

export function saveToken(token: string, email?: string, tenantId?: string): void {
  if (!fs.existsSync(UNISON_CONFIG_DIR)) {
    fs.mkdirSync(UNISON_CONFIG_DIR, { recursive: true })
  }
  const config: UnisonConfig = { token, email, tenantId }
  fs.writeFileSync(UNISON_CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function loadToken(): string | undefined {
  return getToken()
}

async function apiPost<T>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const url = `${getApiUrl()}/v1${path}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = (data.error as Record<string, unknown>) ?? {}
    const code = (err.code as string) ?? String(res.status)
    const message = (err.message as string) ?? `HTTP ${res.status}`
    const error = new Error(message) as Error & { code: string; status: number }
    error.code = code
    error.status = res.status
    throw error
  }
  return data as T
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const url = `${getApiUrl()}/v1${path}`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = (data.error as Record<string, unknown>) ?? {}
    const code = (err.code as string) ?? String(res.status)
    const message = (err.message as string) ?? `HTTP ${res.status}`
    const error = new Error(message) as Error & { code: string; status: number }
    error.code = code
    error.status = res.status
    throw error
  }
  return data as T
}

/**
 * POST /v1/auth/provision — headless account creation.
 * Returns immediately usable (unverified) usk_ key.
 * Throws with code "email_registered" if the email already exists.
 */
export async function provision(email: string): Promise<ProvisionResult> {
  return apiPost<ProvisionResult>("/auth/provision", { email })
}

/**
 * POST /v1/auth/verify — verify OTP from email.
 * Returns {verified, tenantId} on first-time, or {verified, apiKey, tenantId} on recovery.
 */
export async function verify(email: string, code: string): Promise<VerifyResult> {
  return apiPost<VerifyResult>("/auth/verify", { email, code })
}

/**
 * POST /v1/auth/request-key — request recovery OTP for an existing verified account.
 */
export async function requestKey(email: string): Promise<{ status: string }> {
  return apiPost<{ status: string }>("/auth/request-key", { email })
}

/**
 * GET /v1/auth/whoami — confirm auth and fetch tenant/scope info.
 */
export async function whoami(token: string): Promise<WhoamiResult> {
  return apiGet<WhoamiResult>("/auth/whoami", token)
}

/**
 * Run the full machine-auth provision→verify flow interactively.
 * Returns the minted usk_ key (saved to ~/.config/unison/config.json).
 */
export async function runAuthFlow(): Promise<string> {
  const email = (await logger.prompt("Enter your email address to set up Unison Memory:", {
    type: "text",
  })) as string

  if (!email?.includes("@")) {
    throw new Error("Invalid email address.")
  }

  let apiKey: string

  try {
    logger.info("Provisioning your Unison Memory account…")
    const result = await provision(email)
    logger.info("Verification email sent. Check your inbox.")
    apiKey = result.apiKey

    const code = (await logger.prompt("Enter the OTP code from your email:", {
      type: "text",
    })) as string

    if (!code || code.trim() === "") {
      throw new Error("No OTP code provided.")
    }

    const verifyResult = await verify(email, code.trim())

    if (!verifyResult.verified) {
      throw new Error("OTP verification failed.")
    }

    // If key recovery returns a fresh key, use it
    if (verifyResult.apiKey) {
      apiKey = verifyResult.apiKey
    }

    saveToken(apiKey, email, verifyResult.tenantId)
    logger.success("Account verified and token saved to ~/.config/unison/config.json")
  } catch (err) {
    const e = err as Error & { code?: string }
    if (e.code === "email_registered") {
      // Email already registered — run key recovery flow
      logger.info("This email is already registered. Requesting a recovery key…")
      await requestKey(email)
      logger.info("Recovery email sent. Check your inbox.")

      const code = (await logger.prompt("Enter the OTP code from your email:", {
        type: "text",
      })) as string

      if (!code || code.trim() === "") {
        throw new Error("No OTP code provided.")
      }

      const verifyResult = await verify(email, code.trim())

      if (!verifyResult.verified || !verifyResult.apiKey) {
        throw new Error("OTP verification failed.")
      }

      apiKey = verifyResult.apiKey
      saveToken(apiKey, email, verifyResult.tenantId)
      logger.success("Account verified and token saved to ~/.config/unison/config.json")
    } else {
      throw e
    }
  }

  return apiKey
}
