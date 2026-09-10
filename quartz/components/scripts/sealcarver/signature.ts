import { CompoundSeal, Seal, isSingle } from "./types"

// Canonical structural signature of a seal. Order-insensitive and
// count-insensitive: the source treats how MANY of a dagger you draw as
// aesthetic, so recognition matches on dagger type + modifier + placement
// only. A future compound extension prefixes a circle index per segment and
// appends link edges; this single-circle format stays a valid sub-string.
export function signature(seal: Seal): string {
  const h = `${seal.heart.element}/${seal.heart.mode}/${seal.heart.wrap}`
  const d = [...new Set(seal.daggers.map((g) => `${g.dagger}.${g.mod}.${g.placement}`))]
    .sort()
    .join("+")
  const r = seal.ring.plain
    ? "plain"
    : `t:${[...seal.ring.targets].sort().join(",")}|q:${[...seal.ring.qualifiers].sort().join(",")}|x:${seal.ring.trigger}`
  return `${h}//${d}//${r}`
}

// Canonical structural signature of a compound seal. A single circle reduces to
// exactly signature(circle), so every existing single-circle canon entry keeps
// matching. For a real compound it is the core's signature, the sorted set of
// (placement, sub-signature) auxiliaries, and the sorted set of link edges keyed
// by their endpoints' structure rather than array position, so the promise
// carries over: order-insensitive across auxiliaries, count-insensitive within
// each circle, and pairwise-distinct across differently-built compounds.
export function compoundSignature(c: CompoundSeal): string {
  if (isSingle(c)) return signature(c.circles[0].seal)
  const key = (i: number): string =>
    i === 0 ? "core" : `${c.circles[i].placement}:${signature(c.circles[i].seal)}`
  const core = signature(c.circles[0].seal)
  const aux = c.circles
    .slice(1)
    .map((n) => `${n.placement}:${signature(n.seal)}`)
    .sort()
    .join("&")
  const links = [...new Set(c.links.map((e) => `${e.type}:${key(e.from)}>${key(e.to)}`))]
    .sort()
    .join(",")
  return `${core}||${aux}||${links}`
}
