// Chronicle month-grid behavior. Indexes the page's rendered h2 date headings
// and renders one month at a time as a 3x11 grid (the canon week structure:
// days 1 and 11 weekend, day 6 prayer). The script renders NO content: day
// detail is the page's own sections; clicking a recorded day scrolls to it.
// Heading regexes must stay textually equivalent to scripts/check-chronicle.py
// (the publish gate / normalized-event seam).

// The ten canon month names, in order (the campaign's setting/calendar.md).
// The ordinal "of the Ninth Month" heading form was retired 2026-09-26.
const MONTHS = [
  "Vigilia",
  "Sacratio",
  "Oblatio",
  "Certamen",
  "Passio",
  "Requiem",
  "Paenitentia",
  "Gratia",
  "Adventus",
  "Vesper",
]
const MONTH_HEADING_RE = new RegExp(
  `^Day ([1-9]|[12][0-9]|3[0-3]) of (${MONTHS.join("|")}), ([0-9]+) VR$`,
)
const HOLIDAY_HEADING_RE = /^Day ([1-3]) of the Closing Holidays, ([0-9]+) VR$/
const DATE_ATTR_RE = /^([0-9]+)-(0[1-9]|10|H)-(0[1-9]|[12][0-9]|3[0-3])$/

// A month coordinate: year + index 0..9 for months, 10 for the holidays.
type MonthKey = number // year * 11 + monthIndex, totally ordered
const mk = (year: number, monthIndex: number): MonthKey => year * 11 + monthIndex
const mkYear = (k: MonthKey) => Math.floor(k / 11)
const mkIndex = (k: MonthKey) => k % 11

interface DayRef {
  id: string
} // heading element id for deep links
type DayIndex = Map<string, DayRef> // "363-01-12" / "363-H-02" -> ref

const pad = (n: number) => String(n).padStart(2, "0")
const dayKey = (year: number, monthIndex: number, day: number) =>
  `${year}-${monthIndex === 10 ? "H" : pad(monthIndex + 1)}-${pad(day)}`

function parseHeading(text: string): { year: number; monthIndex: number; day: number } | null {
  const m = MONTH_HEADING_RE.exec(text)
  if (m) return { year: +m[3], monthIndex: MONTHS.indexOf(m[2]), day: +m[1] }
  const h = HOLIDAY_HEADING_RE.exec(text)
  if (h) return { year: +h[2], monthIndex: 10, day: +h[1] }
  return null
}

function monthLabel(k: MonthKey): string {
  const year = mkYear(k)
  return mkIndex(k) === 10
    ? `The Closing Holidays, ${year} VR`
    : `${MONTHS[mkIndex(k)]}, ${year} VR`
}

function roleOfColumn(col: number): "weekend" | "prayer" | "work" {
  if (col === 0 || col === 10) return "weekend"
  if (col === 5) return "prayer"
  return "work"
}

function setupChronicle() {
  const root = document.querySelector<HTMLElement>(".chronicle-calendar")
  if (!root) return

  // Guard against re-initializing on a repeated "nav" for the same element
  // (mirrors diplomacy-graph.inline.ts's double-mount guard). On a real SPA
  // nav Quartz swaps in a fresh element, so navigating away and back still
  // re-initializes cleanly; this only blocks binding a second set of nav-button
  // listeners to an element that already has them.
  if (root.dataset.chronicleReady === "1") return
  root.dataset.chronicleReady = "1"

  // Parse current-date; without a valid one the grid cannot anchor, so leave
  // the shell empty (the page remains a readable chronicle regardless).
  const attr = root.dataset.currentDate ?? ""
  const cd = DATE_ATTR_RE.exec(attr)
  if (!cd) return
  const today = {
    year: +cd[1],
    monthIndex: cd[2] === "H" ? 10 : +cd[2] - 1,
    day: +cd[3],
  }
  const todayKey = mk(today.year, today.monthIndex)

  // Index the rendered date sections.
  const index: DayIndex = new Map()
  let minKey = mk(363, 0) // campaign anchor: Vigilia, 363 VR
  for (const h2 of Array.from(document.querySelectorAll<HTMLElement>("article h2"))) {
    const parsed = parseHeading(h2.textContent?.trim() ?? "")
    if (!parsed || !h2.id) continue
    index.set(dayKey(parsed.year, parsed.monthIndex, parsed.day), { id: h2.id })
    minKey = Math.min(minKey, mk(parsed.year, parsed.monthIndex))
  }
  const maxKey = todayKey // the future does not exist yet in-world

  const grid = root.querySelector<HTMLElement>(".chronicle-grid")!
  const label = root.querySelector<HTMLElement>(".chronicle-month-label")!
  const prevBtn = root.querySelector<HTMLButtonElement>(".chronicle-prev")!
  const nextBtn = root.querySelector<HTMLButtonElement>(".chronicle-next")!
  const todayBtn = root.querySelector<HTMLButtonElement>(".chronicle-today-btn")!

  let view: MonthKey = todayKey

  function renderMonth() {
    label.textContent = monthLabel(view)
    prevBtn.disabled = view <= minKey
    nextBtn.disabled = view >= maxKey
    grid.replaceChildren()
    const holidays = mkIndex(view) === 10
    grid.classList.toggle("chronicle-grid-holidays", holidays)
    const dayCount = holidays ? 3 : 33
    if (!holidays) {
      for (let col = 0; col < 11; col++) {
        const head = document.createElement("div")
        head.className = `chronicle-colhead role-${roleOfColumn(col)}`
        head.textContent = String(col + 1)
        grid.appendChild(head)
      }
    }
    for (let d = 1; d <= dayCount; d++) {
      const col = (d - 1) % 11
      const key = dayKey(mkYear(view), mkIndex(view), d)
      const ref = index.get(key)
      const cell = document.createElement(ref ? "button" : "div")
      cell.className = `chronicle-day role-${holidays ? "holiday" : roleOfColumn(col)}`
      cell.textContent = String(d)
      if (ref) {
        cell.classList.add("has-event")
        ;(cell as HTMLButtonElement).type = "button"
        cell.addEventListener("click", () => {
          const target = document.getElementById(ref.id)
          if (!target) return
          history.replaceState(null, "", `#${ref.id}`)
          target.scrollIntoView({ behavior: "smooth", block: "start" })
        })
      } else {
        cell.title = holidays ? "Holiday" : roleOfColumn(col)
      }
      if (view === todayKey && d === today.day) cell.classList.add("is-today")
      grid.appendChild(cell)
    }
  }

  const onPrev = () => {
    if (view > minKey) {
      view--
      renderMonth()
    }
  }
  const onNext = () => {
    if (view < maxKey) {
      view++
      renderMonth()
    }
  }
  const onToday = () => {
    view = todayKey
    renderMonth()
  }
  prevBtn.addEventListener("click", onPrev)
  nextBtn.addEventListener("click", onNext)
  todayBtn.addEventListener("click", onToday)
  window.addCleanup(() => {
    prevBtn.removeEventListener("click", onPrev)
    nextBtn.removeEventListener("click", onNext)
    todayBtn.removeEventListener("click", onToday)
  })

  renderMonth()
}

document.addEventListener("nav", () => {
  setupChronicle()
})
