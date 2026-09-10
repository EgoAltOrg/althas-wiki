import {
  CompoundSeal,
  DaggerGroup,
  DaggerId,
  DaggerMod,
  ElementId,
  LinkType,
  Placement,
  Seal,
  TargetId,
  isSingle,
} from "./types"

// Grammar-derived fallback names for seals that match no canon signature.
// Template (G2-reviewed): "Seal of [Looping |Recurring ]{Element} {Creation|
// Manipulation} by {dagger nouns} upon {target phrase}". The maps are
// exported so the builder UI can reuse them as button labels.

export const ELEMENT_NAMES: Record<ElementId, string> = {
  body: "Body",
  mind: "Mind",
  space: "Space",
  time: "Time",
  magic: "Magic",
  "caster-self": "the Caster's Own Self",
  "nature-blank": "Nature",
  "nature-air": "Air",
  "nature-earth": "Earth",
  "nature-metal": "Metal",
  "nature-plant": "Plant",
  "nature-water": "Water",
  "nature-light": "Light",
  "nature-fire": "Fire",
}

export const DAGGER_NOUNS: Record<DaggerId, string> = {
  absorption: "Absorption",
  expel: "Expulsion",
  surround: "Surrounding",
  grasp: "Grasping",
  break: "Breaking",
  shape: "Shaping",
  disperse: "Dispersal",
  fuse: "Fusion",
  transfer: "Transference",
  "movement-directional": "Directed Motion",
  "movement-omnidirectional": "Free Motion",
  "movement-omnidirectional-surface": "Surface Motion",
  wall: "Walling",
  solidify: "Solidification",
  seek: "Seeking",
  compress: "Compression",
}

export const MOD_PREFIXES: Record<DaggerMod, string> = {
  none: "",
  delay: "Delayed ",
  senses: "Sensory ",
  "shape-sphere": "Spherical ",
  "shape-teardrop": "Teardrop ",
}

export const TARGET_NAMES: Record<TargetId, string> = {
  caster: "the Caster",
  sensed: "the Sensed",
  thought: "a Thought Held",
  touched: "the Touched",
  close: "a Nearby Target",
}

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ""
  return xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]
}

function daggerPhrase(groups: DaggerGroup[]): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const g of groups) {
    const p = MOD_PREFIXES[g.mod] + DAGGER_NOUNS[g.dagger]
    if (!seen.has(p)) {
      seen.add(p)
      parts.push(p)
    }
  }
  return joinList(parts)
}

function targetPhrase(seal: Seal): string {
  const r = seal.ring
  const targets = joinList(r.targets.map((t) => TARGET_NAMES[t]))
  if (r.qualifiers.length === 0) return targets
  const quals = joinList(r.qualifiers.map((q) => ELEMENT_NAMES[q]))
  if (r.targets.length === 1) return `${targets}'s ${quals}`
  return `${targets} (${quals})`
}

export function autoName(seal: Seal): string {
  const wrap =
    seal.heart.wrap === "loop" ? "Looping " : seal.heart.wrap === "reset" ? "Recurring " : ""
  const mode = seal.heart.mode === "create" ? "Creation" : "Manipulation"
  let name = `Seal of ${wrap}${ELEMENT_NAMES[seal.heart.element]} ${mode} by ${daggerPhrase(seal.daggers)}`
  if (!seal.ring.plain) name += ` upon ${targetPhrase(seal)}`
  return name
}

// --- Compound naming --------------------------------------------------------

const LINK_NOUNS: Record<LinkType, string> = {
  transfer: "Transference",
  disperse: "Dispersal",
  fuse: "Fusion",
}

const PLACEMENT_WORDS: Record<Exclude<Placement, "core">, string> = {
  concentric: "concentric",
  inside: "nested",
  beside: "adjoining",
}

function countPhrase(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`
}

// Names a whole compound. A single circle keeps its plain autoName; a real
// compound is named for its core with a clause describing the auxiliaries and
// the linking sigils that bind them.
export function compoundName(compound: CompoundSeal): string {
  if (isSingle(compound)) return autoName(compound.circles[0].seal)
  const core = autoName(compound.circles[0].seal)
  const auxTypes = new Set(compound.circles.slice(1).map((n) => PLACEMENT_WORDS[n.placement as Exclude<Placement, "core">]))
  const auxWord =
    auxTypes.size === 1 ? [...auxTypes][0] + " " : ""
  const auxClause = countPhrase(compound.circles.length - 1, `${auxWord}circle`)
  const linkNouns = [...new Set(compound.links.map((e) => LINK_NOUNS[e.type]))].sort()
  const bound = linkNouns.length ? ` bound by ${joinList(linkNouns)}` : ""
  return `${core}, a compound of ${auxClause}${bound}`
}
