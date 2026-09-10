import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CompoundSeal,
  MAX_CIRCLES,
  Seal,
  defaultCompound,
  defaultSeal,
  isSingle,
  isValidCompound,
  isValidSeal,
  singleToCompound,
  MAX_DAGGER_GROUPS,
} from "./types"

test("defaultSeal is valid", () => {
  assert.equal(isValidSeal(defaultSeal()), true)
})

test("rejects zero dagger groups", () => {
  const s = defaultSeal()
  s.daggers = []
  assert.equal(isValidSeal(s), false)
})

test("rejects more than MAX_DAGGER_GROUPS groups", () => {
  const s = defaultSeal()
  const g = { ...s.daggers[0] }
  s.daggers = Array.from({ length: MAX_DAGGER_GROUPS + 1 }, () => ({ ...g }))
  assert.equal(isValidSeal(s), false)
})

test("rejects count outside 1..8", () => {
  const s = defaultSeal()
  s.daggers[0].count = 0
  assert.equal(isValidSeal(s), false)
  s.daggers[0].count = 9
  assert.equal(isValidSeal(s), false)
})

test("rejects caster-self as a ring qualifier", () => {
  const s: Seal = {
    heart: { element: "magic", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["caster"], qualifiers: ["caster-self"], trigger: "none" },
  }
  assert.equal(isValidSeal(s), false)
})

test("plain ring must carry no targets, qualifiers or trigger", () => {
  const s = defaultSeal()
  s.ring = { plain: true, targets: ["caster"], qualifiers: [], trigger: "none" }
  assert.equal(isValidSeal(s), false)
  s.ring = { plain: true, targets: [], qualifiers: [], trigger: "casters-will" }
  assert.equal(isValidSeal(s), false)
})

test("detailed ring needs at least one target", () => {
  const s = defaultSeal()
  s.ring = { plain: false, targets: [], qualifiers: [], trigger: "none" }
  assert.equal(isValidSeal(s), false)
})

test("rejects duplicate targets", () => {
  const s = defaultSeal()
  s.ring = { plain: false, targets: ["caster", "caster"], qualifiers: [], trigger: "none" }
  assert.equal(isValidSeal(s), false)
})

// --- Compound circles -------------------------------------------------------

function twoCircle(): CompoundSeal {
  return {
    circles: [
      { seal: defaultSeal(), placement: "core" },
      { seal: defaultSeal(), placement: "concentric" },
    ],
    links: [{ type: "transfer", from: 1, to: 0 }],
  }
}

test("defaultCompound is a single valid core circle", () => {
  const c = defaultCompound()
  assert.equal(isValidCompound(c), true)
  assert.equal(isSingle(c), true)
  assert.equal(c.circles[0].placement, "core")
})

test("singleToCompound wraps a seal losslessly", () => {
  const s = defaultSeal()
  const c = singleToCompound(s)
  assert.deepEqual(c.circles[0].seal, s)
  assert.equal(c.links.length, 0)
  assert.equal(isSingle(c), true)
})

test("a valid two-circle compound passes", () => {
  assert.equal(isValidCompound(twoCircle()), true)
  assert.equal(isSingle(twoCircle()), false)
})

test("rejects a compound with zero circles", () => {
  assert.equal(isValidCompound({ circles: [], links: [] }), false)
})

test("rejects more than MAX_CIRCLES circles", () => {
  const circles = Array.from({ length: MAX_CIRCLES + 1 }, (_, i) => ({
    seal: defaultSeal(),
    placement: (i === 0 ? "core" : "beside") as "core" | "beside",
  }))
  assert.equal(isValidCompound({ circles, links: [] }), false)
})

test("the first circle must be the core", () => {
  const c = twoCircle()
  c.circles[0].placement = "beside"
  assert.equal(isValidCompound(c), false)
})

test("an auxiliary circle may not be the core", () => {
  const c = twoCircle()
  c.circles[1].placement = "core"
  assert.equal(isValidCompound(c), false)
})

test("rejects a link with an out-of-range endpoint", () => {
  const c = twoCircle()
  c.links = [{ type: "transfer", from: 0, to: 5 }]
  assert.equal(isValidCompound(c), false)
})

test("rejects a self-link", () => {
  const c = twoCircle()
  c.links = [{ type: "fuse", from: 1, to: 1 }]
  assert.equal(isValidCompound(c), false)
})

test("a single circle may not carry links", () => {
  const c = singleToCompound(defaultSeal())
  c.links = [{ type: "transfer", from: 0, to: 0 }]
  assert.equal(isValidCompound(c), false)
})

test("rejects a compound holding an invalid seal", () => {
  const c = twoCircle()
  c.circles[1].seal.daggers = []
  assert.equal(isValidCompound(c), false)
})
