import assert from "node:assert/strict"
import { test } from "node:test"
import { CANON, findCanon, findCanonCompound } from "./canon"
import { signature } from "./signature"
import { CompoundSeal, Seal, isValidSeal, singleToCompound } from "./types"

test("thirteen Arcana entries", () => {
  assert.equal(CANON.filter((c) => c.domain === "Arcana").length, 13)
})

test("every canon seal is valid", () => {
  for (const c of CANON) {
    assert.equal(isValidSeal(c.seal), true, `${c.name} is invalid`)
  }
})

test("all canon signatures are pairwise distinct", () => {
  const sigs = CANON.map((c) => signature(c.seal))
  const dupes = sigs.filter((s, i) => sigs.indexOf(s) !== i)
  assert.deepEqual(dupes, [], `colliding signatures: ${dupes.join(" ; ")}`)
})

test("findCanon matches Flight at a different dagger count", () => {
  const flight: Seal = {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    // canon table uses count 4; a player using 6 still discovers Flight
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 6, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }
  assert.equal(findCanon(signature(flight))?.name, "Flight")
})

test("findCanon returns undefined for a non-canon seal", () => {
  const s: Seal = {
    heart: { element: "nature-plant", mode: "create", wrap: "reset" },
    daggers: [{ dagger: "wall", mod: "senses", count: 3, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }
  assert.equal(findCanon(signature(s)), undefined)
})

test("Arcana entries are hidden from the gallery", () => {
  for (const c of CANON.filter((c) => c.domain === "Arcana")) {
    assert.equal(c.gallery, false, `${c.name} must not spoil the discovery pool`)
  }
})

test("nine Codex gallery entries, grouped in three books", () => {
  const codex = CANON.filter((c) => c.domain === "Codex")
  assert.equal(codex.length, 9)
  assert.equal(
    codex.every((c) => c.gallery && c.level === 1 && c.book),
    true,
  )
  assert.equal(new Set(codex.map((c) => c.book)).size, 3)
})

test("findCanonCompound resolves a single-circle compound against canon", () => {
  const flight: Seal = {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }
  assert.equal(findCanonCompound(singleToCompound(flight))?.name, "Flight")
})

test("findCanonCompound returns undefined for a real compound (no compound canon yet)", () => {
  const c: CompoundSeal = {
    circles: [
      {
        seal: {
          heart: { element: "body", mode: "manipulate", wrap: "loop" },
          daggers: [
            { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
          ],
          ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
        },
        placement: "core",
      },
      { seal: CANON[0].seal, placement: "beside" },
    ],
    links: [{ type: "transfer", from: 1, to: 0 }],
  }
  assert.equal(findCanonCompound(c), undefined)
})
