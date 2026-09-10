import assert from "node:assert/strict"
import { test } from "node:test"
import { autoName, compoundName } from "./naming"
import { CompoundSeal, Seal, defaultSeal, singleToCompound } from "./types"

test("default seal name", () => {
  assert.equal(autoName(defaultSeal()), "Seal of Fire Creation by Expulsion")
})

test("flight-shaped seal name", () => {
  const s: Seal = {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }
  assert.equal(
    autoName(s),
    "Seal of Looping Body Manipulation by Free Motion upon the Caster's Body",
  )
})

test("delayed expel renders Delayed Expulsion", () => {
  const s = defaultSeal()
  s.daggers[0].mod = "delay"
  assert.equal(autoName(s), "Seal of Fire Creation by Delayed Expulsion")
})

test("plain ring omits the upon clause", () => {
  const name = autoName(defaultSeal())
  assert.equal(name.includes("upon"), false)
})

test("two dagger groups join with and", () => {
  const s = defaultSeal()
  s.daggers.push({ dagger: "grasp", mod: "none", count: 4, placement: "symmetric" })
  assert.equal(autoName(s), "Seal of Fire Creation by Expulsion and Grasping")
})

test("reset wrap renders Recurring", () => {
  const s = defaultSeal()
  s.heart.wrap = "reset"
  assert.equal(autoName(s), "Seal of Recurring Fire Creation by Expulsion")
})

// --- Compound naming --------------------------------------------------------

test("a single-circle compound keeps its plain name", () => {
  assert.equal(compoundName(singleToCompound(defaultSeal())), autoName(defaultSeal()))
})

test("a two-circle compound names its core, aux and link", () => {
  const c: CompoundSeal = {
    circles: [
      { seal: defaultSeal(), placement: "core" },
      { seal: defaultSeal(), placement: "beside" },
    ],
    links: [{ type: "transfer", from: 1, to: 0 }],
  }
  assert.equal(
    compoundName(c),
    "Seal of Fire Creation by Expulsion, a compound of 1 adjoining circle bound by Transference",
  )
})

test("a four-satellite compound pluralises and lists distinct links", () => {
  const c: CompoundSeal = {
    circles: [
      { seal: defaultSeal(), placement: "core" },
      { seal: defaultSeal(), placement: "beside" },
      { seal: defaultSeal(), placement: "beside" },
      { seal: defaultSeal(), placement: "beside" },
    ],
    links: [
      { type: "transfer", from: 1, to: 0 },
      { type: "disperse", from: 2, to: 0 },
    ],
  }
  assert.equal(
    compoundName(c),
    "Seal of Fire Creation by Expulsion, a compound of 3 adjoining circles bound by Dispersal and Transference",
  )
})
