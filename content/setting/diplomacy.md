---
title: Diplomacy
aliases:
  - setting/organizations
---

**Summary**: A map of how the five nations of [[index|Althas]] and the powers within them stand toward each other, five years after the Jesthaen Treaty, in two views: a force-graph of their relationships, and a per-nation register of every organization's tier, assets, problems, and scored standings. It draws only on relationships already stated elsewhere in the wiki.

---

The decade of warfare that the Jesthaen Treaty ended in 361 VR left the continent divided and the peace uneasy. This page lays out where the five nations and their governing powers stand toward one another. The web below can be dragged into new arrangements, and each power links to its own page. Below the graph, the register breaks the same web down organization by organization.

```diplomacy-graph
# Nodes: slug | display name | kind | site page path
node voldaen | Voldaen | nation | locations/voldaen
node polaris | Polaris | nation | locations/polaris
node armada | Armada | nation | locations/armada
node jesthaen | Jesthaen | nation | locations/jesthaen
node hilltop | Hilltop | nation | locations/hilltop
node the-holy-see | The Holy See | institution | organizations/the-holy-see
node parish-of-inquisition | Parish of Inquisition | institution | organizations/parish-of-inquisition
node guild | The Guild | institution | organizations/guild
node house-voldis | House Voldis | institution | organizations/house-voldis
node parish-of-orthodoxy | Parish of Orthodoxy | institution | organizations/parish-of-orthodoxy
node infernis | Infernis | people | ancestries/infernis
node amalthus-cruoris | Amalthus Cruoris | people | npcs/amalthus-cruoris
node valis-voldis | Valis Voldis | people | npcs/valis-voldis
node aldric-voldis | Aldric Voldis | people | npcs/aldric-voldis
node lael | Lael | people | npcs/lael
node lyra-aquila | Lyra Aquila | people | npcs/lyra-aquila
node hesper-arcturus | Hesper Arcturus | people | npcs/hesper-arcturus
node augustus-corvus | Augustus Corvus | people | npcs/augustus-corvus
node zhenya-azimuth | Zhenya Azimuth | people | npcs/zhenya-azimuth
node house-azimuth | House Azimuth | institution | organizations/house-azimuth
node house-olnir | House Olnir | institution | organizations/house-olnir
node the-witherwatch | The Witherwatch | institution | organizations/the-witherwatch
node the-council-of-six | The Council of Six | institution | organizations/the-council-of-six

# Edges: source -> target (arrow) or <-> (mutual) | type | label
edge house-voldis -> voldaen | governance | royal dynasty, rules
edge the-holy-see -> hilltop | governance | divine regent, governs the faith from
edge parish-of-inquisition -> the-holy-see | governance | investigative and judicial arm of
edge guild -> armada | governance | governs
edge armada -> infernis | uneasy | sometimes tolerates
edge voldaen <-> polaris | rivalry | rivals
edge hilltop -> voldaen | war-history | sent aid in the rebellion
edge the-holy-see -> voldaen | war-history | allied in the rebellion
edge polaris -> jesthaen | war-history | backed the rebels
edge armada -> jesthaen | war-history | backed the rebels
edge polaris <-> armada | alliance | fragile wartime alliance
edge jesthaen <-> voldaen | uneasy | revolution, then a tenuous peace
edge parish-of-orthodoxy -> the-holy-see | governance | doctrinal arm of
edge amalthus-cruoris -> the-holy-see | governance | Pontiff, leads
edge amalthus-cruoris -> parish-of-orthodoxy | governance | leads
edge valis-voldis -> voldaen | governance | reigning queen, council figurehead
edge aldric-voldis -> jesthaen | governance | founder, leads
edge aldric-voldis -> house-voldis | uneasy | spurned baseborn son
edge lael -> parish-of-inquisition | governance | Lord Commander, leads
edge lyra-aquila -> polaris | governance | Triumvirate archmage
edge hesper-arcturus -> polaris | governance | Triumvirate archmage
edge augustus-corvus -> voldaen | governance | Minister of War
edge augustus-corvus -> jesthaen | rivalry | led Voldaen's armies against, wants the war renewed
edge augustus-corvus -> aldric-voldis | war-history | brothers-in-arms in the Ophanim War, then enemies
edge zhenya-azimuth -> voldaen | governance | Minister of the Royal Household
edge house-azimuth -> voldaen | governance | Great House, holds the Royal Household
edge house-olnir -> voldaen | governance | Great House, sworn to the Crown
edge the-witherwatch -> voldaen | governance | frontier garrison, raised by
edge the-holy-see -> the-council-of-six | governance | funds Andaluria's reconstruction
edge the-council-of-six -> hilltop | governance | governs Andaluria in
```

## The two sides of the war

The fighting that the Jesthaen Treaty ended had two sides. [[voldaen|Voldaen]] held the old monarchy, [[hilltop|Hilltop]] sent aid to it, and [[the-holy-see|the Holy See]] stood with it as well. Against them stood [[jesthaen|Jesthaen]], the republic that had broken away from Voldaen during the Voldis Succession Crisis, with [[polaris|Polaris]] and [[armada|Armada]] backing the rebels. The treaty stopped active combat in 361 VR without resolving what had caused it, and the peace between Voldaen and Jesthaen remains tenuous. [[voldaen|Voldaen's]] Minister of War, [[augustus-corvus|Augustus Corvus]], the undefeated commander who lost no battle in that war, is the loudest voice in the capital for renewed conflict. He once fought beside [[aldric-voldis|Aldric]] as a brother-in-arms, in the years before the two nations were set against each other.

## Rivalries and alliances

[[voldaen|Voldaen]] and [[polaris|Polaris]] were rivals before the war and stayed rivals through it. Polaris began as a group of scholars and mages who broke away from Hilltop, and it sided with the rebels against Voldaen's monarchy. Its alliance with [[armada|Armada]] and Jesthaen carried them through the fighting, but with the common enemy gone that alliance is now called fragile.

## Who governs whom

Several powers on the map are not nations but the institutions that run them. [[house-voldis|House Voldis]] is the royal dynasty of Voldaen. [[the-holy-see|The Holy See]] governs the faith from Hilltop and fields the [[parish-of-inquisition|Parish of Inquisition]] as its investigative and judicial arm. [[armada|Armada]] answers to [[guild|the Guild]] rather than to any single ruler. Armada is also the one nation that sometimes tolerates the [[infernis|Infernis]], who are banned almost everywhere else.

## Organizations

A register of every organization on [[index|Althas]], grouped by the nation or region it is seated in, with each group's tier, assets, problems, and relationships. This is the same web the graph above draws, scored organization by organization.

### Voldaen

The oldest nation. A proud monarchy of [[house-voldis|House Voldis]], shaken by [[jesthaen|Jesthaen]]'s secession and living under a tenuous armistice.

**[[house-voldis|House Voldis]] / the Crown** (Tier 5, ruling)
- **Blurb**: The oldest crown on the continent, rich and divine by its own claim, its grip loosened by [[jesthaen|Jesthaen]]'s secession and a queen who reigns without ruling.
- **Assets**: divine-right legitimacy (claimed God King descent), the oldest crown on the continent, vast ancestral wealth, House Voldis's dynastic network.
- **Problems**: post-secession upheaval, having lost the south to [[jesthaen|Jesthaen]]; border settlements exposed to [[polaris|Polaris]] and Jesthaen; Queen [[valis-voldis|Valis Voldis]] reigns but does not truly rule.
- **Relationships**: [[the-holy-see|Holy See]] +2, [[jesthaen|Jesthaen]] -2, [[polaris|Polaris]] -2, [[armada|Armada]] -1.
- **Objective**: pending design pass.

**The Council of Great Houses** (Tier 4) *(placeholder name, pending design pass)*
- **Blurb**: The great houses that work the throne's machinery from behind it, holding real power for as long as the fiction of the Crown's rule survives.
- **Assets**: the great houses' combined wealth, lands, and levies; control of the throne's machinery; an entrenched bureaucratic grip.
- **Problems**: rivalry between the houses; an authority resting on a fiction it must keep intact; exposure if the queen asserts herself or a rival seizes her.
- **Relationships** (publicly presents as the Crown's own): [[the-holy-see|Holy See]] +2, [[jesthaen|Jesthaen]] -2, [[polaris|Polaris]] -2, [[armada|Armada]] -1.
- **Objective**: pending design pass.

**The Ministry of War** ([[augustus-corvus|Augustus Corvus]]) (Tier 3)
- **Blurb**: [[voldaen|Voldaen]]'s standing army under the undefeated [[augustus-corvus|Augustus Corvus]], chafing at an armistice that forbids the war it was built to fight.
- **Assets**: Voldaen's standing army; [[augustus-corvus|Augustus]], the undefeated commander who lost no battle in the war; a veteran officer corps and its prestige.
- **Problems**: leashed by the armistice it despises; the treaty forbids the very war it exists for.
- **Relationships**: [[jesthaen|Jesthaen]] -3, Crown +2, Council +1.
- **Objective**: pending design pass.

**[[house-azimuth|House Azimuth]]** (Tier 3)
- **Blurb**: An ancient [[voldaen|Voldaen]] Great House, first to back the Blessed King against the Mad King's heresy, keeper ever since of the Minister of the Royal Household's office, held now by [[zhenya-azimuth|Zhenya Azimuth]].
- **Assets**: an ancient Great House's wealth and lands; the hereditary office of Minister of the Royal Household; holyblood and a House Miracle; a long record of loyalty to the Crown.
- **Problems**: a standing that rests on old service and a young head; rivalry among the Great Houses.
- **Relationships**: Crown +3, Council +2, [[jesthaen|Jesthaen]] -2.
- **Objective**: pending design pass.

**[[house-olnir|House Olnir]]** (Tier 2)
- **Blurb**: An old [[voldaen|Voldaen]] Great House feared for a rite it will not name, stripped of its ministry after its heir [[lorkhan-olnir|Lorkhan]] joined [[aldric-voldis|Aldric's]] revolution, holding its noble standing now only by a newly sworn fealty.
- **Assets**: the fortress seat of Mambaril; the Miracle of Fames; a fearsome name; ruthless resourcefulness.
- **Problems**: stripped of its ministry after its heir's defection; noble standing held only by a newly sworn fealty; the dread the House's name carries.
- **Relationships**: Crown +1, Council +1, [[jesthaen|Jesthaen]] -1.
- **Objective**: pending design pass.

**[[the-witherwatch|The Witherwatch]]** (Tier 2)
- **Blurb**: The standing garrison [[voldaen|Voldaen]] keeps at the [[godless-gate|Godless Gate]], holding the blighted [[witherwild-continent|Witherwild]] frontier with condemned men and unwanted heirs, and scarcely thanked for it.
- **Assets**: the fortress at the [[godless-gate|Godless Gate]]; hardened frontier watchmen; generations of holding the pass.
- **Problems**: under-resourced and disregarded; ranks filled by condemned men and cast-off heirs; a history of desertion at the top.
- **Relationships**: Crown +1.
- **Objective**: pending design pass.

### Jesthaen

The newest nation. A republic [[aldric-voldis|Aldric Voldis]] broke away from [[voldaen|Voldaen]], five years recognized and still proving itself.

**The Republic** ([[aldric-voldis|Aldric Voldis]]) (Tier 5, ruling)
- **Blurb**: The five-year-old republic [[aldric-voldis|Aldric Voldis]] broke from [[voldaen|Voldaen]], strong in land and arms but still proving a recognition that came only recently.
- **Assets**: a strong land military, natural resources and arable land, a revolutionary mandate, [[aldric-voldis|Aldric]] the war-hero founder.
- **Problems**: young-nation instability; conservative pro-Voldaen holdouts; fresh, fragile recognition.
- **Relationships**: [[armada|Armada]] +2, [[polaris|Polaris]] +1, [[voldaen|Voldaen]] -2, [[the-holy-see|Holy See]] -2.
- **Objective**: pending design pass.

**Revolution-era Slyborne networks** (Tier 3)
- **Blurb**: The smuggling routes that carried the revolution, now wary as the republic they served courts the legitimacy that would disown them.
- **Assets**: smuggling routes, a black-market economy, revolution-forged loyalty, cross-border reach into [[armada|Armada]].
- **Problems**: a republic seeking legitimacy may turn on its old smuggler allies; friction with Armada's pirate families over the same trade.
- **Relationships**: [[armada|Armada]] +1, Republic +1.
- **Objective**: pending design pass.

### Polaris

A magocracy of scholars and mages, its industrial rise built on [[giants|Giant]] labor it later discarded.

**The Triumvirate of Archmages** ([[lyra-aquila|Lyra Aquila]] and [[hesper-arcturus|Hesper Arcturus]]) (Tier 5, ruling)
- **Blurb**: The archmages who rule the magocracy, rich in magitech and airships but short of labor and raw stock, a restive [[giants|giant]] underclass beneath them.
- **Assets**: skilled mages, magitech, airships, magical creatures, the academies.
- **Problems**: a worker shortage, poor raw materials, a restive [[giants|giant]] underclass.
- **Relationships**: [[armada|Armada]] +1, [[jesthaen|Jesthaen]] +1, [[voldaen|Voldaen]] -2, [[the-holy-see|Holy See]] -3.
- **Objective**: pending design pass.

**The [[giants|Giants]] of Polaris** (labor underclass) (Tier 2)
- **Blurb**: The giant laborers whose hands built [[polaris|Polaris]], strong in number and grievance yet held without legal standing or a voice.
- **Assets**: indispensable labor, numbers, physical power, a righteous grievance.
- **Problems**: a disenfranchised non-magical underclass with no legal standing.
- **Relationships**: Triumvirate -2.
- **Objective**: pending design pass.

### Armada

A merchant federation of pirate-founded trade cities, governed by tokens, looser and more tolerant than its neighbors.

**[[guild|The Guild]]** (token-holding city-states) (Tier 5, ruling)
- **Blurb**: The token-holding cities that rule [[armada|Armada]]'s seas, wealthy and well-charted but land-poor, their power resting in tokens that can be taken.
- **Assets**: a large navy, superior sea charts, allied water monsters, mercantile wealth.
- **Problems**: a small land area, limited overland access, a pirate reputation; power that sits in physical tokens that can be stolen.
- **Relationships**: [[jesthaen|Jesthaen]] +2, [[polaris|Polaris]] +1, [[voldaen|Voldaen]] -1, [[the-holy-see|Holy See]] -2.
- **Objective**: pending design pass.

**The pirate and Slyborne families** (Tier 3)
- **Blurb**: [[armada|Armada]]'s founding pirate lines, still running the black-market trade the [[guild|Guild]] would rather forget as it reaches for respectability.
- **Assets**: the founding bloodlines, black-market trade, naval irregulars, smuggling networks.
- **Problems**: the [[guild|Guild]]'s drive for legitimacy sidelines them; rivalry with Jesthaen's smugglers.
- **Relationships**: [[guild|Guild]] +1, Jesthaen Slyborne +1.
- **Objective**: pending design pass.

### Hilltop

Not a nation but the ruined heart of the One Above's faith: seat of the See, the Parishes, and older, darker things.

**[[the-holy-see|The Holy See]]** (Pontiff [[amalthus-cruoris|Amalthus Cruoris]]) (Tier 5, ruling of the section)
- **Blurb**: The [[the-one-above|One Above]]'s church, wealthy and armed in every nation, its central teaching shaken by [[the-ophanim|the Ophanim]]'s fall and a schism stirring in its own ranks.
- **Assets**: tithe wealth, a devout army, priests and seraphs, a continent-wide temple network (holdings in every nation), the Parishes, the [[miracles|Miracles]].
- **Problems**: [[hilltop|Hilltop]] devastated by [[the-ophanim|the Ophanim]]; the angel's fall has thrown the faith's central teaching into question; a schism brewing in its own ranks.
- **Relationships**: [[voldaen|Voldaen]] +2, [[armada|Armada]] -2, [[jesthaen|Jesthaen]] -2, [[polaris|Polaris]] -3.
- **Objective**: pending design pass.

**[[parish-of-orthodoxy|The Parish of Orthodoxy]]** (Tier 4)
- **Blurb**: Keeper of scripture and proper worship for the [[the-holy-see|See]], now pressed to rule on what the fallen [[the-ophanim|Ophanim]] means for the faith.
- **Assets**: doctrinal authority, control of scripture and proper worship, a scholarly clergy.
- **Problems**: the [[the-ophanim|Ophanim]] crisis strains orthodox teaching; it must rule on what the fallen angel means.
- **Relationships**: [[the-holy-see|Holy See]] +3, [[parish-of-inquisition|Parish of Inquisition]] +1.
- **Objective**: pending design pass.

**[[parish-of-inquisition|The Parish of Inquisition]]** ([[lael|Lael]], Lord Commander) (Tier 4)
- **Blurb**: The [[the-holy-see|See]]'s feared investigators and judges under [[lael|Lael]], an intelligence arm whose zeal is beginning to outrun the See's control.
- **Assets**: feared investigators, judicial authority, the Reborn rite, an intelligence network.
- **Problems**: quietly fracturing from within; its zeal outruns the See's control.
- **Relationships**: [[the-holy-see|Holy See]] +2, [[parish-of-orthodoxy|Parish of Orthodoxy]] +1.
- **Objective**: pending design pass.

**[[the-council-of-six|The Council of Six]]** (Tier 3)
- **Blurb**: The six offices that govern [[andaluria|Andaluria's]] reconstruction from Jesaña, funded by [[the-holy-see|the Holy See]] and the patronage of [[ysabela-delamona|Ysabela IV]] to rebuild the holy capital after the Crisis.
- **Assets**: six offices over Andaluria's reconstruction; funding from the Holy See's merchant-road taxes and the patronage of [[ysabela-delamona|Ysabela IV]]; the standing of the holy capital's government.
- **Problems**: a ruined capital to rebuild with little daylight and less labor; dependence on outside purses; the weight of restoring the faith's holy seat.
- **Relationships**: [[the-holy-see|Holy See]] +2.
- **Objective**: pending design pass.

## Related pages

- [[index|Althas]]
- [[timeline|Timeline]]
- [[voldaen|Voldaen]]
- [[polaris|Polaris]]
- [[armada|Armada]]
- [[jesthaen|Jesthaen]]
- [[hilltop|Hilltop]]
- [[the-holy-see|The Holy See]]
- [[parish-of-inquisition|Parish of Inquisition]]
- [[parish-of-orthodoxy|Parish of Orthodoxy]]
- [[guild|The Guild]]
- [[house-voldis|House Voldis]]
- [[infernis|Infernis]]
