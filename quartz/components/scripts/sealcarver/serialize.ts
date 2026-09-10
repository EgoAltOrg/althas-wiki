import { CompoundSeal, Seal, isValidCompound, isValidSeal, singleToCompound } from "./types"

// Compact, URL-safe seal encoding for share links and localStorage. JSON in
// base64url out; decode validates through isValidSeal so a tampered or
// stale payload degrades to null (caller falls back to the default seal).

function toB64Url(s: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(s, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(s)))
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64Url(s: string): string | null {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  try {
    return typeof Buffer !== "undefined"
      ? Buffer.from(b64, "base64").toString("utf8")
      : decodeURIComponent(escape(atob(b64)))
  } catch {
    return null
  }
}

export function encodeSeal(seal: Seal): string {
  return toB64Url(JSON.stringify(seal))
}

export function decodeSeal(encoded: string): Seal | null {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null
  const json = fromB64Url(encoded)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const s = parsed as Seal
  if (typeof s !== "object" || s === null || !s.heart || !Array.isArray(s.daggers) || !s.ring) {
    return null
  }
  return isValidSeal(s) ? s : null
}

// Compound seals encode the same way. decodeCompound also accepts a legacy
// bare-Seal payload (a pre-compound share link or saved seal) and wraps it, so
// no existing link or stored seal breaks.
export function encodeCompound(compound: CompoundSeal): string {
  return toB64Url(JSON.stringify(compound))
}

export function decodeCompound(encoded: string): CompoundSeal | null {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null
  const json = fromB64Url(encoded)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  // Legacy: a bare single seal (has a heart, no circles array). Wrap it.
  if (!("circles" in parsed) && "heart" in parsed) {
    const s = parsed as Seal
    if (!s.heart || !Array.isArray(s.daggers) || !s.ring) return null
    return isValidSeal(s) ? singleToCompound(s) : null
  }
  const c = parsed as CompoundSeal
  if (!Array.isArray(c.circles) || !Array.isArray(c.links)) return null
  return isValidCompound(c) ? c : null
}
