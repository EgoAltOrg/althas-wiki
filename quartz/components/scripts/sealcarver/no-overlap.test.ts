import assert from "node:assert/strict"
import { test } from "node:test"
import { firstOverlap } from "./compose"
import {
  AUX_PLACEMENTS,
  CompoundSeal,
  DAGGERS,
  DAGGER_MODS,
  DaggerId,
  DaggerMod,
  ELEMENTS,
  ElementId,
  HeartMode,
  HeartWrap,
  LINK_TYPES,
  MAX_CIRCLES,
  MAX_DAGGER_GROUPS,
  MAX_RING_QUALIFIERS,
  MAX_RING_TARGETS,
  Placement,
  Seal,
  TARGETS,
  TargetId,
  TriggerId,
  isValidCompound,
  isValidSeal,
  singleToCompound,
} from "./types"

// The no-overlap invariant (Sealcarver plan, Global Constraints + Task 14): for
// ANY seal a user can build, no two sigils ever overlap. The grammar is bounded
// (isValidSeal / isValidCompound), so "any input" is a finite, known space; this
// suite pins down that the composer's closed-loop fit clears it everywhere, by
// asserting firstOverlap() is null for the worst cases and a large random sample.

function why(c: CompoundSeal): string {
  const o = firstOverlap(c)
  if (!o) return ""
  return `overlap: ${o.a.unit} (${o.a.key}) x ${o.b.unit} (${o.b.key})\n${JSON.stringify(c)}`
}

function assertClear(c: CompoundSeal): void {
  assert.ok(isValidCompound(c), `test built an invalid compound: ${JSON.stringify(c)}`)
  assert.equal(firstOverlap(c), null, why(c))
}

// --- Enumerated worst cases -------------------------------------------------

const MODS: DaggerMod[] = DAGGER_MODS
const WRAPS: HeartWrap[] = ["none", "loop", "reset"]

test("worst case: three full dagger groups, every modifier, full ring band", () => {
  // 3 groups x count 8 = 24 daggers is the densest dagger ring the grammar allows.
  for (const mod of MODS) {
    for (const placement of ["symmetric", "directional"] as Placement[]) {
      for (const wrap of WRAPS) {
        const seal: Seal = {
          heart: { element: "magic", mode: "manipulate", wrap },
          daggers: [
            { dagger: "expel", mod, count: 8, placement },
            { dagger: "grasp", mod, count: 8, placement },
            { dagger: "break", mod, count: 8, placement },
          ],
          // fullest legal band: 2 targets, 2 qualifiers, a trigger
          ring: {
            plain: false,
            targets: ["caster", "sensed"],
            qualifiers: ["body", "mind"],
            trigger: "casters-will",
          },
        }
        assert.ok(isValidSeal(seal))
        assertClear(singleToCompound(seal))
      }
    }
  }
})

test("worst case: two directional groups that naturally coincide", () => {
  // Two directional groups both centre on 90 degrees; only the even-spread
  // fallback can separate them.
  for (const count of [1, 4, 8]) {
    const seal: Seal = {
      heart: { element: "nature-fire", mode: "create", wrap: "loop" },
      daggers: [
        { dagger: "expel", mod: "delay", count, placement: "directional" },
        { dagger: "movement-directional", mod: "none", count, placement: "directional" },
      ],
      ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
    }
    assert.ok(isValidSeal(seal))
    assertClear(singleToCompound(seal))
  }
})

test("worst case: every single dagger type at max count with delay", () => {
  for (const dagger of DAGGERS) {
    const seal: Seal = {
      heart: { element: "magic", mode: "create", wrap: "reset" },
      daggers: [{ dagger, mod: "delay", count: 8, placement: "symmetric" }],
      ring: { plain: false, targets: ["thought"], qualifiers: ["space"], trigger: "targets-will" },
    }
    assert.ok(isValidSeal(seal))
    assertClear(singleToCompound(seal))
  }
})

test("worst case: the five-circle compound, every placement, dense circles", () => {
  const dense = (dagger: DaggerId): Seal => ({
    heart: { element: "magic", mode: "manipulate", wrap: "loop" },
    daggers: [{ dagger, mod: "senses", count: 8, placement: "symmetric" }],
    ring: {
      plain: false,
      targets: ["sensed", "close"],
      qualifiers: ["mind"],
      trigger: "casters-will",
    },
  })
  const c: CompoundSeal = {
    circles: [
      { seal: dense("expel"), placement: "core" },
      { seal: dense("grasp"), placement: "beside" },
      { seal: dense("break"), placement: "beside" },
      { seal: dense("surround"), placement: "concentric" },
      { seal: dense("compress"), placement: "inside" },
    ],
    links: [
      { type: "transfer", from: 1, to: 0 },
      { type: "disperse", from: 2, to: 0 },
      { type: "fuse", from: 3, to: 0 },
      { type: "transfer", from: 4, to: 0 },
    ],
  }
  assertClear(c)
})

// --- Randomized fuzz over the whole valid space -----------------------------

// Small seeded PRNG so a failure is reproducible.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const int = (r: () => number, lo: number, hi: number): number =>
  lo + Math.floor(r() * (hi - lo + 1))

const NON_CASTER = ELEMENTS.filter((e) => e !== "caster-self") as ElementId[]

function randomSeal(r: () => number): Seal {
  const groups = int(r, 1, MAX_DAGGER_GROUPS)
  const daggers = Array.from({ length: groups }, () => ({
    dagger: pick(r, DAGGERS) as DaggerId,
    mod: pick(r, DAGGER_MODS) as DaggerMod,
    count: int(r, 1, 8),
    placement: pick(r, ["symmetric", "directional"] as Placement[]),
  }))
  const plain = r() < 0.35
  let ring
  if (plain) {
    ring = {
      plain: true,
      targets: [] as TargetId[],
      qualifiers: [] as ElementId[],
      trigger: "none" as TriggerId,
    }
  } else {
    const nt = int(r, 1, MAX_RING_TARGETS)
    const nq = int(r, 0, MAX_RING_QUALIFIERS)
    const targets: TargetId[] = []
    while (targets.length < nt) {
      const t = pick(r, TARGETS) as TargetId
      if (!targets.includes(t)) targets.push(t)
    }
    const qualifiers: ElementId[] = []
    while (qualifiers.length < nq) {
      const q = pick(r, NON_CASTER)
      if (!qualifiers.includes(q)) qualifiers.push(q)
    }
    ring = {
      plain: false,
      targets,
      qualifiers,
      trigger: pick(r, ["none", "casters-will", "targets-will"] as TriggerId[]),
    }
  }
  return {
    heart: {
      element: pick(r, ELEMENTS) as ElementId,
      mode: pick(r, ["create", "manipulate"] as HeartMode[]),
      wrap: pick(r, WRAPS),
    },
    daggers,
    ring,
  }
}

function randomCompound(r: () => number): CompoundSeal {
  const n = int(r, 1, MAX_CIRCLES)
  const circles = Array.from({ length: n }, (_, i) => ({
    seal: randomSeal(r),
    placement: i === 0 ? ("core" as const) : pick(r, AUX_PLACEMENTS),
  }))
  const links =
    n === 1
      ? []
      : Array.from({ length: int(r, 0, n - 1) }, () => {
          let from = int(r, 0, n - 1)
          let to = int(r, 0, n - 1)
          while (to === from) to = int(r, 0, n - 1)
          return { type: pick(r, LINK_TYPES), from, to }
        })
  return { circles, links }
}

test("fuzz: 1200 random valid single seals never overlap", () => {
  const r = rng(0xa11ce)
  let checked = 0
  while (checked < 1200) {
    const seal = randomSeal(r)
    if (!isValidSeal(seal)) continue
    assertClear(singleToCompound(seal))
    checked++
  }
  assert.equal(checked, 1200)
})

test("fuzz: 500 random valid compounds never overlap", () => {
  const r = rng(0xc0ffee)
  let checked = 0
  while (checked < 500) {
    const c = randomCompound(r)
    if (!isValidCompound(c)) continue
    assertClear(c)
    checked++
  }
  assert.equal(checked, 500)
})
