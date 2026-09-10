import { SIGILS, SigilAsset } from "./sigils.gen"
import { CompoundSeal, DaggerGroup, Seal, isSingle } from "./types"

// Renders a Seal (or a whole CompoundSeal) as a self-contained SVG string using
// rigid transforms only (translate, rotate, uniform scale), the same
// composition method the source author uses: sigil path data is embedded
// verbatim, never warped. Stroke widths are rescaled proportionally
// (orig / scale) so every sigil draws at a consistent apparent pen weight while
// keeping the artist's deliberate weight ratios within each sigil.
//
// A single circle draws on a 1000x1000 viewBox exactly as before. A compound
// lays several circles out on a larger square canvas: satellites sit beside the
// core (each a full small circle), concentric and nested circles add ring-bands
// that share the core's centre and Heart, and the linking sigils (Transfer,
// Disperse, Fuse) are drawn between the circles they join.

const C = 500
const R_OUTER = 482
const R_INNER = 424
const R_PLAIN = 453
const R_DAGGER = 300
const R_MOD = R_DAGGER + 88
const R_BAND = 453
const HEART_W = 210
const CASTER_HEART_W = 260
const WRAP_W = 330
const TARGET_W = 250
const QUAL_H = 52
const MOD_W = 56
const TRIGGER_W = 46
const DAGGER_W = 135

// One circle's geometry on the shared canvas. A standalone circle uses the
// base frame; auxiliaries override centre, radii, sigil scale and whether the
// Heart is drawn (concentric and nested auxiliaries share the core's Heart, so
// they suppress their own).
interface Frame {
  cx: number
  cy: number
  ringOuter: number
  ringInner: number
  ringPlain: number
  daggerR: number
  modR: number
  bandR: number
  scale: number // multiplies sigil sizes (Heart, targets, daggers, ...)
  stroke: number // ring stroke width
  drawHeart: boolean
}

function baseFrame(cx = C, cy = C): Frame {
  return {
    cx,
    cy,
    ringOuter: R_OUTER,
    ringInner: R_INNER,
    ringPlain: R_PLAIN,
    daggerR: R_DAGGER,
    modR: R_MOD,
    bandR: R_BAND,
    scale: 1,
    stroke: 5,
    drawHeart: true,
  }
}

function rescaleStrokes(body: string, s: number): string {
  return body.replace(
    /stroke-width:([\d.]+)px/g,
    (_, w) => `stroke-width:${(parseFloat(w) / s).toFixed(3)}px`,
  )
}

function place(
  key: string,
  cx: number,
  cy: number,
  target: number,
  rot = 0,
  fit: "w" | "h" = "w",
): string {
  const a: SigilAsset | undefined = SIGILS[key]
  if (!a) throw new Error(`unknown sigil ${key}`)
  const s = target / (fit === "w" ? a.w : a.h)
  const dw = a.w * s
  const dh = a.h * s
  return (
    `<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${rot.toFixed(2)})">` +
    `<svg x="${(-dw / 2).toFixed(2)}" y="${(-dh / 2).toFixed(2)}" width="${dw.toFixed(2)}" height="${dh.toFixed(2)}" ` +
    `viewBox="0 0 ${a.w} ${a.h}" overflow="visible">${rescaleStrokes(a.body, s)}</svg></g>`
  )
}

// Place a sigil on a ring of the given absolute radius around a frame's centre.
function onRing(
  f: Frame,
  key: string,
  radius: number,
  angleDeg: number,
  target: number,
  fit: "w" | "h" = "w",
): string {
  const a = (angleDeg * Math.PI) / 180
  return place(key, f.cx + radius * Math.sin(a), f.cy - radius * Math.cos(a), target, angleDeg, fit)
}

function groupAngles(
  g: DaggerGroup,
  gi: number,
  nGroups: number,
  hasDirectional: boolean,
): number[] {
  if (g.placement === "directional") {
    // Keep the whole cluster inside ~120 degrees so a high count still reads
    // as one directed volley rather than a scatter.
    const spread = Math.min(38, 120 / Math.max(g.count - 1, 1))
    return Array.from({ length: g.count }, (_, i) => 90 + (i - (g.count - 1) / 2) * spread)
  }
  const step = 360 / Math.max(g.count, 1)
  // With a directional cluster at 90, anchor symmetric slots opposite it
  // (one slot at 270) so the two never collide; otherwise start at 0.
  const base = hasDirectional ? 270 % step : 0
  const offset = base + gi * (step / nGroups)
  return Array.from({ length: g.count }, (_, i) => offset + i * step)
}

// Sigils are placed with rot = ring angle, which points their authored "up"
// outward. Sigils authored sideways need a correction so their arrow points
// radially out instead of chasing the circle (expel's arrow points right in
// its own frame; G2 feedback caught the tangential drift).
const ORIENT: Partial<Record<string, number>> = { expel: -90 }

function heart(f: Frame, seal: Seal): string {
  if (!f.drawHeart) return ""
  const parts: string[] = []
  const { element, mode, wrap } = seal.heart
  const k = f.scale
  if (wrap !== "none") parts.push(place(`modifiers/${wrap}`, f.cx, f.cy, WRAP_W * k))
  if (element === "caster-self") {
    // Blink Out's construction: the Caster target sigil serves as the Heart,
    // with the bare mode modifier beneath it (no pre-composed asset exists).
    parts.push(place("targets/caster", f.cx, f.cy - 14 * k, CASTER_HEART_W * k))
    parts.push(place(`modifiers/${mode}`, f.cx, f.cy + 56 * k, 80 * k))
  } else {
    parts.push(place(`elements/${element}-${mode}`, f.cx, f.cy, HEART_W * k))
  }
  return parts.join("")
}

function daggers(f: Frame, seal: Seal): string {
  const parts: string[] = []
  const n = seal.daggers.length
  const k = f.scale
  const hasDirectional = seal.daggers.some((g) => g.placement === "directional")
  seal.daggers.forEach((g, gi) => {
    for (const ang of groupAngles(g, gi, n, hasDirectional)) {
      const orient = ORIENT[g.dagger] ?? 0
      const a = (ang * Math.PI) / 180
      const dx = f.cx + f.daggerR * Math.sin(a)
      const dy = f.cy - f.daggerR * Math.cos(a)
      parts.push(place(`functions/${g.dagger}`, dx, dy, DAGGER_W * k, ang + orient))
      if (g.mod === "none") continue
      if (g.mod === "senses") {
        // Senses sits adjacent to its sigil (Cloaking Blast's construction).
        parts.push(onRing(f, `modifiers/${g.mod}`, f.modR, ang, MOD_W * k))
      } else {
        // Delay WRAPS its sigil (p8: "Expel with Delay" draws the brackets
        // around the arrow); Shape mods are set INTO the Shape sigil's slot.
        // Either way the mod shares the sigil's center AND final rotation so
        // the composite reads as one glyph.
        const w = (g.mod === "delay" ? 205 : 40) * k
        parts.push(place(`modifiers/${g.mod}`, dx, dy, w, ang + orient))
      }
    }
  })
  return parts.join("")
}

function ring(f: Frame, seal: Seal): string {
  const stroke = `style="fill:none;stroke:currentColor;stroke-width:${f.stroke}px;"`
  if (seal.ring.plain) {
    return `<circle cx="${f.cx}" cy="${f.cy}" r="${f.ringPlain}" ${stroke}/>`
  }
  const k = f.scale
  const parts = [
    `<circle cx="${f.cx}" cy="${f.cy}" r="${f.ringOuter}" ${stroke}/>`,
    `<circle cx="${f.cx}" cy="${f.cy}" r="${f.ringInner}" ${stroke}/>`,
  ]
  const targets = seal.ring.targets
  targets.forEach((t, i) => {
    const step = 360 / targets.length
    for (const base of [0, 180]) {
      // each target appears twice for symmetry (author's rings repeat strips)
      const ang = base + i * (step / 2)
      parts.push(onRing(f, `targets/${t}`, f.bandR, ang, TARGET_W * k))
    }
  })
  seal.ring.qualifiers.forEach((q, i) => {
    for (const kk of [0, 1, 2, 3]) {
      parts.push(onRing(f, `elements/${q}`, f.bandR, 45 + i * 22.5 + kk * 90, QUAL_H * k, "h"))
    }
  })
  if (seal.ring.trigger !== "none") {
    for (const kk of [0, 1, 2, 3]) {
      parts.push(onRing(f, `triggers/${seal.ring.trigger}`, f.bandR, 22.5 + kk * 90, TRIGGER_W * k))
    }
  }
  return parts.join("")
}

function circle(f: Frame, seal: Seal): string {
  return ring(f, seal) + heart(f, seal) + daggers(f, seal)
}

export function compose(seal: Seal): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">` +
    circle(baseFrame(), seal) +
    `</svg>`
  )
}

export function composeForSave(seal: Seal, bg: "white" | "transparent"): string {
  let svg = compose(seal).replace(/currentColor/g, "#000000")
  if (bg === "white") {
    svg = svg.replace(">", `><rect width="1000" height="1000" fill="#ffffff"/>`)
  }
  return svg
}

// --- Compound layout --------------------------------------------------------

const CORE_FOOT = 500 // the core circle's footprint radius
const CONCENTRIC_BAND = 150 // radial width each concentric ring-band adds
const SAT_SCALE = 0.46 // satellite circles draw a little under half size
const SAT_OVERLAP = 0.6 // satellite centre sits R_OUTER + 0.6*satRing out, so the core ring cuts its inner ~40%

// Compute a Frame per circle, plus a square viewBox that contains them all.
// Circles work in a centre-origin space; the viewBox is squared and padded so
// on-screen (100% width) and 2000x2000 export both stay undistorted, matching
// the author's square 1000 / 1500 / 2000 canvases.
function layout(compound: CompoundSeal): { frames: Frame[]; view: string } {
  const frames: Frame[] = new Array(compound.circles.length)
  frames[0] = baseFrame(0, 0) // core

  let concentric = 0
  let nested = 0
  const satellites: number[] = []
  compound.circles.forEach((node, i) => {
    if (i === 0) return
    if (node.placement === "beside") satellites.push(i)
  })

  compound.circles.forEach((node, i) => {
    if (i === 0) return
    if (node.placement === "concentric") {
      const level = ++concentric
      const ringOuter = R_OUTER + level * CONCENTRIC_BAND
      frames[i] = {
        cx: 0,
        cy: 0,
        ringOuter,
        ringInner: ringOuter - 58,
        ringPlain: ringOuter - 15,
        daggerR: ringOuter - 96, // daggers sit in the new outer band
        modR: ringOuter - 40,
        bandR: ringOuter - 28,
        scale: 0.72,
        stroke: 5,
        drawHeart: false,
      }
    } else if (node.placement === "inside") {
      const level = ++nested
      const ringOuter = Math.max(120, 250 - (level - 1) * 70) // small ring(s) within the core
      frames[i] = {
        cx: 0,
        cy: 0,
        ringOuter,
        ringInner: ringOuter - 40,
        ringPlain: ringOuter - 12,
        daggerR: Math.max(64, ringOuter - 64),
        modR: ringOuter - 22,
        bandR: ringOuter - 18,
        scale: 0.42,
        stroke: 4,
        drawHeart: false,
      }
    }
  })

  // Satellites OVERLAP the core: the core ring cuts through each one's inner
  // portion (the source draws Telekinesis and Floating Eye this way), with the
  // satellite's centre just outside the core ring and its inner ~40% inside it.
  const satRing = R_OUTER * SAT_SCALE
  const dist = R_OUTER + satRing * SAT_OVERLAP
  satellites.forEach((i, slot) => {
    const ang = (slot * (360 / satellites.length) * Math.PI) / 180
    const cx = dist * Math.sin(ang)
    const cy = -dist * Math.cos(ang)
    const f = baseFrame(cx, cy)
    f.scale = SAT_SCALE
    f.ringOuter *= SAT_SCALE
    f.ringInner *= SAT_SCALE
    f.ringPlain *= SAT_SCALE
    f.daggerR *= SAT_SCALE
    f.modR *= SAT_SCALE
    f.bandR *= SAT_SCALE
    f.stroke = 4
    frames[i] = f
  })

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const f of frames) {
    const foot = Math.max(f.ringOuter, f.daggerR, f.modR) + 24
    minX = Math.min(minX, f.cx - foot)
    maxX = Math.max(maxX, f.cx + foot)
    minY = Math.min(minY, f.cy - foot)
    maxY = Math.max(maxY, f.cy + foot)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const side = Math.max(maxX - minX, maxY - minY) + 40
  const x0 = cx - side / 2
  const y0 = cy - side / 2
  const view = `${x0.toFixed(1)} ${y0.toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`
  return { frames, view }
}

// The linking sigil for one edge, placed between the two circles it joins. For
// distinct centres (a satellite link) it sits at the midpoint, its authored
// "up" pointing from source to target. For a shared centre (concentric/nested)
// it sits in the band between the two rings at a fixed angle.
function linkSigil(edge: CompoundSeal["links"][number], frames: Frame[]): string {
  const f = frames[edge.from]
  const t = frames[edge.to]
  const key = `functions/${edge.type}`
  const size = 120 * ((f.scale + t.scale) / 2 + 0.3)
  const dx = t.cx - f.cx
  const dy = t.cy - f.cy
  const dist = Math.hypot(dx, dy)
  if (dist < 5) {
    const rr = (f.ringOuter + t.ringOuter) / 2
    return onRing(f, key, rr, 35, size)
  }
  // The overlapping satellite and the core meet in a lens; the source draws the
  // link sigil in that lens. Anchor at the midpoint (along the centre line) of
  // the overlap between the larger circle's rim and the smaller circle's inner
  // edge. When they do not overlap this lands in the gap between them, which is
  // still the right place.
  const big = f.ringOuter >= t.ringOuter ? f : t
  const small = big === f ? t : f
  const ux = (small.cx - big.cx) / dist
  const uy = (small.cy - big.cy) / dist
  const along = (big.ringOuter + (dist - small.ringOuter)) / 2
  const px = big.cx + along * ux
  const py = big.cy + along * uy
  const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI
  const orient = ORIENT[edge.type] ?? 0
  return place(key, px, py, size, angleDeg + orient)
}

export function composeCompound(compound: CompoundSeal): string {
  if (isSingle(compound)) return compose(compound.circles[0].seal)
  const { frames, view } = layout(compound)
  const circles = compound.circles.map((node, i) => circle(frames[i], node.seal)).join("")
  const links = compound.links.map((e) => linkSigil(e, frames)).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">` + circles + links + `</svg>`
}

export function composeCompoundForSave(
  compound: CompoundSeal,
  bg: "white" | "transparent",
): string {
  if (isSingle(compound)) return composeForSave(compound.circles[0].seal, bg)
  let svg = composeCompound(compound).replace(/currentColor/g, "#000000")
  if (bg === "white") {
    const vb = svg.match(/viewBox="([^"]+)"/)
    if (vb) {
      const [x, y, w, h] = vb[1].split(" ")
      svg = svg.replace(">", `><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`)
    }
  }
  return svg
}
