import assert from "node:assert/strict"
import { test } from "node:test"
import { compose, composeCompound, composeCompoundForSave, composeForSave } from "./compose"
import { SIGILS } from "./sigils.gen"
import { CompoundSeal, Seal, defaultSeal, singleToCompound } from "./types"

function detailed(): Seal {
  return {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "casters-will" },
  }
}

test("output is a self-contained themed svg", () => {
  const svg = compose(detailed())
  assert.ok(svg.startsWith("<svg"))
  assert.ok(svg.includes('viewBox="0 0 1000 1000"'))
  assert.ok(!svg.includes("stroke:black"))
  assert.ok(!svg.includes("<image"))
  assert.ok(!svg.includes("xlink:href"))
  assert.ok(svg.includes("currentColor"))
})

test("a 4-count symmetric group embeds its sigil exactly 4 times", () => {
  const svg = compose(detailed())
  // strip stroke-width rescaling before counting verbatim bodies
  const norm = (s: string) => s.replace(/stroke-width:[\d.]+px/g, "SW")
  const body = norm(SIGILS["functions/movement-omnidirectional"].body)
  const hay = norm(svg)
  let n = 0
  for (let i = hay.indexOf(body); i !== -1; i = hay.indexOf(body, i + 1)) n++
  assert.equal(n, 4)
})

test("detailed ring emits two circles, plain ring one", () => {
  const twoRings = compose(detailed())
  assert.equal((twoRings.match(/<circle/g) ?? []).length >= 2, true)
  const plain = compose(defaultSeal())
  const own = (plain.match(/r="453"/g) ?? []).length
  assert.equal(own, 1)
})

test("trigger sigils appear when set", () => {
  const withTrigger = compose(detailed())
  const norm = (s: string) => s.replace(/stroke-width:[\d.]+px/g, "SW")
  assert.ok(norm(withTrigger).includes(norm(SIGILS["triggers/casters-will"].body)))
})

test("export variants are theme independent", () => {
  const white = composeForSave(detailed(), "white")
  assert.ok(white.includes("<rect"))
  assert.ok(white.includes("#000000"))
  assert.ok(!white.includes("currentColor"))
  const transparent = composeForSave(detailed(), "transparent")
  assert.ok(!transparent.includes("<rect"))
  assert.ok(!transparent.includes("currentColor"))
})

test("caster-self heart composes without pre-composed asset", () => {
  const s = detailed()
  s.heart = { element: "caster-self", mode: "manipulate", wrap: "none" }
  const svg = compose(s)
  const norm = (x: string) => x.replace(/stroke-width:[\d.]+px/g, "SW")
  assert.ok(norm(svg).includes(norm(SIGILS["targets/caster"].body)))
  assert.ok(norm(svg).includes(norm(SIGILS["modifiers/manipulate"].body)))
})

// --- Compound composition ---------------------------------------------------

function twoBeside(): CompoundSeal {
  return {
    circles: [
      { seal: defaultSeal(), placement: "core" },
      { seal: detailed(), placement: "beside" },
    ],
    links: [{ type: "transfer", from: 1, to: 0 }],
  }
}

test("a single-circle compound renders identically to the plain seal", () => {
  assert.equal(composeCompound(singleToCompound(detailed())), compose(detailed()))
})

test("a compound uses a larger square viewBox", () => {
  const svg = composeCompound(twoBeside())
  const vb = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(" ")
    .map(Number)
  assert.equal(vb.length, 4)
  assert.equal(vb[2], vb[3]) // square
  assert.ok(vb[2] > 1000) // larger than a single circle
})

test("a compound stays self-contained and themed", () => {
  const svg = composeCompound(twoBeside())
  assert.ok(!svg.includes("stroke:black"))
  assert.ok(!svg.includes("<image"))
  assert.ok(!svg.includes("xlink:href"))
  assert.ok(svg.includes("currentColor"))
})

test("a compound draws its link sigil", () => {
  const svg = composeCompound(twoBeside())
  const norm = (s: string) => s.replace(/stroke-width:[\d.]+px/g, "SW")
  assert.ok(norm(svg).includes(norm(SIGILS["functions/transfer"].body)))
})

test("a concentric aux shares the core Heart (no second element sigil)", () => {
  const core = defaultSeal() // Create Fire heart
  const aux: Seal = {
    heart: { element: "body", mode: "create", wrap: "none" },
    daggers: [{ dagger: "absorption", mod: "none", count: 3, placement: "symmetric" }],
    ring: { plain: false, targets: ["sensed"], qualifiers: [], trigger: "none" },
  }
  const c: CompoundSeal = {
    circles: [
      { seal: core, placement: "core" },
      { seal: aux, placement: "concentric" },
    ],
    links: [],
  }
  const svg = composeCompound(c)
  const norm = (s: string) => s.replace(/stroke-width:[\d.]+px/g, "SW")
  // the aux's Body-create Heart sigil must NOT appear (its Heart is suppressed)
  assert.ok(!norm(svg).includes(norm(SIGILS["elements/body-create"].body)))
  // but the core's Fire-create Heart does
  assert.ok(norm(svg).includes(norm(SIGILS["elements/nature-fire-create"].body)))
})

test("compound export variants are theme independent", () => {
  const white = composeCompoundForSave(twoBeside(), "white")
  assert.ok(white.includes("<rect"))
  assert.ok(white.includes("#000000"))
  assert.ok(!white.includes("currentColor"))
  const transparent = composeCompoundForSave(twoBeside(), "transparent")
  assert.ok(!transparent.includes("<rect"))
  assert.ok(!transparent.includes("currentColor"))
})
