import { compoundSignature, signature } from "./signature"
import { CompoundSeal, Seal } from "./types"

// Canon seal table. Arcana entries transcribe the worked circles in the
// Codex of Arcane Arts (Roc Humet Vidal, CC-BY 4.0), levels 1-10, single
// circles only. gallery:false keeps them out of the Codex Seals gallery so
// they stay a hidden discovery pool.
//
// Excluded Arcana spells and why:
// - Chain Lightning: Compress modifiers wrap the HEART and extra imprint
//   sigils feed the target; exceeds the single-circle grammar model.
// - Floating Eye, Telekinesis, Rift Walker, Cloaking Blast, Arcane
//   Reflection, Confusing Aura, Sensory Projection, Falling Sky 1+2:
//   compound / multi-circle constructions, planned for the compound update.

export interface CanonSeal {
  name: string
  level: number
  domain: "Arcana" | "Codex"
  book?: string
  gallery: boolean
  seal: Seal
}

const arcana = (name: string, level: number, seal: Seal): CanonSeal => ({
  name,
  level,
  domain: "Arcana",
  gallery: false,
  seal,
})

export const CANON: CanonSeal[] = [
  arcana("Rune Ward", 1, {
    heart: { element: "magic", mode: "create", wrap: "loop" },
    daggers: [
      { dagger: "surround", mod: "none", count: 2, placement: "symmetric" },
      { dagger: "wall", mod: "none", count: 2, placement: "symmetric" },
      { dagger: "break", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["thought"], qualifiers: [], trigger: "none" },
  }),
  arcana("Unleash Chaos", 1, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [
      { dagger: "absorption", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "expel", mod: "delay", count: 3, placement: "directional" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["mind"], trigger: "none" },
  }),
  arcana("Wall Walk", 1, {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional-surface", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["touched"], qualifiers: ["body"], trigger: "targets-will" },
  }),
  arcana("Cinder Grasp", 2, {
    heart: { element: "nature-fire", mode: "create", wrap: "none" },
    daggers: [{ dagger: "grasp", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["thought"], qualifiers: ["body"], trigger: "none" },
  }),
  arcana("Instant Counterspell", 3, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "break", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["thought"], qualifiers: [], trigger: "casters-will" },
  }),
  arcana("Simple Counterspell", 3, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "break", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Flight", 3, {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }),
  arcana("Blink Out", 4, {
    heart: { element: "caster-self", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "surround", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["space"], trigger: "none" },
  }),
  arcana("Preservation Blast 1", 4, {
    heart: { element: "magic", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 6, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Preservation Blast 2", 4, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [
      { dagger: "absorption", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "expel", mod: "none", count: 3, placement: "symmetric" },
    ],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Premonition", 5, {
    heart: { element: "time", mode: "manipulate", wrap: "none" },
    daggers: [
      { dagger: "movement-directional", mod: "none", count: 4, placement: "symmetric" },
      { dagger: "surround", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["mind"], trigger: "casters-will" },
  }),
  arcana("Earthquake", 9, {
    heart: { element: "nature-earth", mode: "manipulate", wrap: "reset" },
    daggers: [
      { dagger: "compress", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "break", mod: "delay", count: 3, placement: "symmetric" },
      { dagger: "movement-omnidirectional", mod: "none", count: 3, placement: "symmetric" },
    ],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Adjust Reality", 10, {
    heart: { element: "time", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "seek", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["thought"], qualifiers: ["time"], trigger: "none" },
  }),
]

const codex = (name: string, book: string, seal: Seal): CanonSeal => ({
  name,
  level: 1,
  domain: "Codex",
  book,
  gallery: true,
  seal,
})

// The nine Level 1 Codex grimoire spells, seal designs authored for Althas
// (approved by Lucas at the G2 gate, 2026-08-06, incl. the outward-pointing
// expel orientation). New canon: these are ours, not the supplement's.
export const CODEX_SEALS: CanonSeal[] = [
  codex("Power Push", "Book of Ava", {
    heart: { element: "body", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "movement-directional", mod: "none", count: 3, placement: "directional" }],
    ring: { plain: false, targets: ["close"], qualifiers: ["body"], trigger: "none" },
  }),
  codex("Tava's Armor", "Book of Ava", {
    heart: { element: "magic", mode: "create", wrap: "loop" },
    daggers: [{ dagger: "grasp", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["touched"], qualifiers: ["body"], trigger: "none" },
  }),
  codex("Ice Spike", "Book of Ava", {
    heart: { element: "nature-water", mode: "create", wrap: "none" },
    daggers: [
      { dagger: "solidify", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "shape", mod: "shape-teardrop", count: 3, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["space"], trigger: "none" },
  }),
  codex("Slumber", "Book of Illiat", {
    heart: { element: "mind", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "surround", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["close"], qualifiers: ["mind"], trigger: "none" },
  }),
  codex("Arcane Barrage", "Book of Illiat", {
    heart: { element: "magic", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 6, placement: "directional" }],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["body"], trigger: "none" },
  }),
  codex("Telepathy", "Book of Illiat", {
    heart: { element: "mind", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "absorption", mod: "senses", count: 2, placement: "symmetric" },
      { dagger: "disperse", mod: "senses", count: 2, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["mind"], trigger: "none" },
  }),
  codex("Wild Flame", "Book of Tyfar", {
    heart: { element: "nature-fire", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 3, placement: "directional" }],
    ring: { plain: false, targets: ["close"], qualifiers: ["body"], trigger: "none" },
  }),
  codex("Magic Hand", "Book of Tyfar", {
    heart: { element: "magic", mode: "create", wrap: "loop" },
    daggers: [
      { dagger: "shape", mod: "none", count: 2, placement: "symmetric" },
      { dagger: "movement-omnidirectional", mod: "none", count: 2, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["space"], trigger: "none" },
  }),
  codex("Mysterious Mist", "Book of Tyfar", {
    heart: { element: "nature-water", mode: "create", wrap: "none" },
    daggers: [{ dagger: "disperse", mod: "none", count: 6, placement: "symmetric" }],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["space"], trigger: "none" },
  }),
]

CANON.push(...CODEX_SEALS)

let index: Map<string, CanonSeal> | undefined

export function findCanon(sig: string): CanonSeal | undefined {
  if (!index) {
    index = new Map(CANON.map((c) => [signature(c.seal), c]))
  }
  return index.get(sig)
}

// Compound-aware canon lookup. A single-circle compound reduces to its plain
// signature (compoundSignature), so every existing single-circle canon entry
// still resolves; a real compound matches only a compound canon entry, of which
// there are none yet (the gallery stays single-circle Codex canon for now).
export function findCanonCompound(compound: CompoundSeal): CanonSeal | undefined {
  return findCanon(compoundSignature(compound))
}
