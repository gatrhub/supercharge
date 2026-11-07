---
description: The house design grammar — a worked example of extracted structural rules from user-validated surfaces, plus the extraction protocol for deriving YOUR product's grammar from its own validated surfaces. Load at design-spec time (13-design-spec.mdc) before composing any rendered surface.
---

# Design grammar — the house bar

This is the conditioning material the design-spec gate (`13-design-spec.mdc`)
requires: the structural grammar of surfaces the **user has validated as
the quality bar** — extracted at concrete-value level, not adjectives.
Load it when writing `.unlazy/design-spec/<sid>.md` so the spec borrows the
house vocabulary instead of the corpus prior.

## The canonical anchor: the discussion board (`topic` channel) *(example — replace with your product's validated anchor)*

> **Adopter note:** the sections below are a *worked example* — the grammar
> extracted from one product's validated surface. Run the extraction
> protocol at the end of this file against YOUR validated surfaces and
> replace these sections with what you find. The shape (chrome, anatomy,
> emphasis, payload classes) is the reusable part; the specifics are not.

User-validated 2026-11-03 ("do you see the high quality of design and high
quality UI?"). Its grammar, extracted from the rendered surface:

**Identity element.** Every board-grade surface gets a *place identity* —
the board uses a header banner with a faint topographic/contour motif, a
doc-tile icon, the board name, a "N topics" count, and the action cluster.
A surface that could belong to any app is a utility surface.

**Three voices minimum.** Every element knows its rank:
- *primary* — the title/heading: bold, full `--app-text`, largest
- *secondary* — excerpt/description: quieter (`--app-text-secondary`), 1–2 lines
- *meta* — attribution row: smallest (avatar + role-colored name + chips +
  time), reads as a single scannable strip
Nothing fights at the same weight. A label and quoted content sharing one
12px-muted voice is the canonical anti-pattern.

**Accent budget: one.** Exactly one saturated accent per surface — the
board's blue "+ New topic". More than one is competition, not emphasis.

**Affordances shaped like their function.** The vote box is a distinct
rounded block (arrow + count) that also creates a rhythm down the left
edge of every row. The view-mode switcher is a five-icon cluster (list /
compact / rows / gallery / reader). No text pretending to be a control.

**Micro-copy does social work.** "Be the first to comment" — an
invitation, not a statistic ("0 comments"). Copy invites or explains; it
doesn't report numbers at the user.

**Whitespace is the separator.** Rows divide by breathing room and
hairlines, not boxes. Density comes from chips and meta, never from
cramming.

**The rail earns its space.** Right-rail cards surface governance and
context — "About discussion" (created date, activity), "Moderators" (who
runs this + "Message the mods" as a real action). A rail that decorates
instead of governing gets cut.

**Toolbar discipline.** Sort dropdown + filter chip + search + layout
cluster, grouped and compact — controls that adapt the surface to its
content, all quiet-weight so the one accent wins.

**Restraint is the load-bearing axis — what the board refuses.** Quality
lives in what the exemplar *doesn't* do as much as what it does. Extracted
refusals: no surface hosts more than ~4 sections; no modal/sheet carries a
multi-column scroll; no element out-weights the content's primary voice;
no page opens a second chrome class inside the first (a page doesn't
wear a modal). A surface that needs more jobs than the exemplar's
equivalent has a structure problem, not a styling problem.

**Calm at rest.** Interactive state appears on demand — hover, focus,
open — not at rest. Buttons sit quiet until needed; badges appear when
they carry information; nothing pulses, glows, or elevates to beg.
Density comes from chips and meta strips, never from simultaneous
competing controls.

**Chrome-fit.** Each surface class wears the chrome the exemplar family
uses: boards are pages, topic detail is a page/reader, settings are
modals/sheets with ≤3 sections, pickers are popovers. The chrome class
is part of the exemplar's grammar — a different class for the same job
is a structural divergence, not a styling choice.

**Input craft.** Controls are house primitives, not browser natives:
checkboxes, selects, radios, toggles are styled components with real
states (rest/hover/focus/disabled), labels that sentence-case, and
helper copy where the control isn't self-evident. A raw `<select>` or
default checkbox is corpus prior leaking into a house surface.

**Copy taxonomy.** Headings noun-phrase ("Event reminders", not
"Reminders" alone when the section needs its anchor); actions verb-first
("+ New topic", "Save settings"); empty states invite ("Be the first
to comment"); meta attributes quietly. Every label is checkable against
one question: does a first-time member know what this is?

## The banned basins (negative space — unreachable, not just flagged)

- flat same-weight text runs across different content roles
- text as pseudo-control
- more than one saturated accent
- boxes/dividers where whitespace should separate
- statistics-as-copy where an invitation belongs
- no identity element of its own — could-belong-to-any-app chrome, or
  the exemplar's identity recycled instead of this surface's own
- secondary surfaces that outshout the content they frame
- native browser controls where the house has primitives — a raw
  `<select>` or default checkbox is the corpus prior, not a decision
- more jobs than the exemplar's equivalent surface carries — density
  past the exemplar's budget is a structure violation, not ambition
- a chrome class the exemplar family never uses for that job — a modal
  where the exemplar's is a page is structural divergence, not flavor
- user-facing text naming a different feature — "Discussion board
  settings" inside the community editor is wrong-product text
- "frame furniture" amnesty — shell chrome (topbar, sidebar, member
  rail, logo) shown at placeholder quality inside a render. The whole
  frame is judged: real house chrome copied from real source, or the
  region is visibly labeled wireframe. Emoji/unicode glyphs as icons
  are the same basin — the house has `ui/design/icons.js` primitives
- accent-as-wallpaper — one hue is not one accent. The accent budget
  is loudness: a single saturated hue diffused across tiles, pills,
  links, glows and active states emphasizes nothing. The accent's job
  is contrast
- reference-free composition — building a house surface from memory
  or a summary doc instead of the real render. Grammar extracted
  without captures is adjectives; the exemplar and the shell chrome
  get screenshotted before the spec, always
- approximated chrome — shell elements (topbar, sidebar, rails,
  logo, scrollbars) redrawn from a screenshot or approximation
  instead of lifted from real `ui/` source. A screenshot carries
  ~30% of a real element's spec; the rest is prior. Approximated
  chrome is fake chrome at lower resolution — chrome rows cite
  `file:line` or they're invented
- vocabulary laundering — design terms ("shaped affordance",
  "composed region", "authored expression") applied to elements
  whose plain description is a default template. Describe it in
  literal words first: "rounded box, border, arrow over number" —
  if the plain sentence sounds like nothing, the element is
  nothing, and the design word is a costume
- single-shot elements — craft is revision; an element generated
  once and kept was plotted down, not designed. Authored elements
  get a second pass where v1 is the thing to beat
- invented classes under real names — DOM authored with
  house-sounding class names that don't exist in the real
  stylesheet. The class says "real", the paint underneath is
  invented. Provenance laundering: where the dump doesn't cover,
  the region is marked wireframe — never dressed in a real name
- verbatim-lift-as-verdict — lifting a real component lifts its
  trade-offs, not just its look: `fill:transparent` rest states,
  hover-only affordances. The lift is the start of the judgment —
  does this rest state read on THIS surface — never the end of it
- token-name-binding — consuming a `--app-*` token whose resolved
  value was never checked at the element. A bundle that redefines
  the var on a stronger selector turns every authored accent into
  a second accent hue on one surface — invisible until probed
- unlabeled-interactive — a data-viz or control whose meaning
  exists only in a tooltip or hover is silent at rest.
  Pretty-but-unexplained is still unexplained; hover is a state,
  not a legend
- edge-accent bars — a colored stripe painted along one edge of a
  card (the left border is the canonical form; a top inset bar is
  the same move rotated) is a stock AI-design tell, recognizable
  to a general audience as machine-generated — USER-PROHIBITED. It
  ships in four authored forms, all banned on cards, list rows,
  nav items, and posts: (a) `border-left`/`border-inline-start` in
  an accent color or ≥2px, (b) a `::before`/`::after` pseudo pinned
  to the left edge as a thin bar (the active-nav-item glow pill),
  (c) a thin element stretched along the left edge — a real DOM
  node with `width: ≤8px` + `align-self: stretch` or absolute
  top-bottom pinning (the post "kind" strip — often split across a
  base class for shape and modifier classes for paint), (d) an
  `inset Npx 0 0` box-shadow drawing the same stripe. Neutral 1px
  separators, quote/callout conventions, and named divider elements
  are legitimate. State emphasis (pinned, required, featured,
  active) comes from fill, weight, tags, and hierarchy — never from
  a colored edge rail. RENDER-LINT flags all four forms at write
  time; `/* edge-ok: <why> */` dispositions a real use (timeline
  rails, thread indents)
- ornamental ordinals on navigation — numbered nav links and
  per-item index chips (`01 Home`, `02 Explore`, `.nav__idx`,
  `<span class="n">01</span>`) carry a "systematic document"
  register that reads machine-stamped outside numbered documents —
  USER-PROHIBITED on member surfaces. Two unrelated builds shipped
  it in one week (the gs3 nav, the security doc's nav + crumbs);
  the corpus prior reaches for ordinals whenever it wants
  "technical rigor". Legit: numbers that ARE the content's own
  identity — legal § references, wizard step numbers, pagination —
  defend with `ordinal-ok: <why>`. Nav identity comes from the
  label and the icon, never an index. RENDER-LINT flags the
  authored forms (ordinal element inside nav-context markup, a
  nav-context class or selector naming idx/num/ord/seq) at write
  time, JS templates included
- prose-in-bullets — styling element classes instead of asking what
  the information IS. `<li><strong>Term —</strong> paragraph` items
  are key-value data wearing list styling: dozens to hundreds of
  name—explanation pairs want a definition register, labeled list,
  or table — not a decorated bullet. The secdoc carried 310 of them
  plus 8 Issue/Gap records rendered as stacked cards (a case-file
  anatomy, not boxes). A restyle that enumerates DOM vocabulary
  ("li") in its inventory and never enumerates information shapes
  re-skins the payload it was asked to redesign. The probe counts
  the shapes (defList/recordHeads/checklist); `## Content shapes`
  in the spec decides each one's anatomy (become — X / keep — why);
  SHAPE-AUDIT flags measured-but-undecided patterns
- reach-in controls — a control that only exists at the end of a
  long scroll or in a collapsed popover the user can't find
  functions as absent. Preview/switcher furniture that must be
  operable lives in the toolbar row where view controls belong,
  not in page furniture at the document foot

- chrome-stack-in-one-luminance-band — bg, surface, raised, and line
  inside ~5% total relative-luminance range: the "washed out" both
  failed mockups shipped. Deliberate restraint is fine ON a tonal
  background with loud content; on sparse content the same restraint
  is absence. Computed, not eyeballed — the arithmetic probe holds
  the declared ΔL floors, and a stranger can't tell bg from card
  from rail at a glance
- hairline-only separation on a tonal field — a card whose only
  boundary on a filled background is a 1px hairline reads as a region
  the designer forgot to finish; the exemplar classes separate by
  tonal step + shadow + radius working together, not a rule line
- void-island shell — a content-width cap that leaves >40% of the
  DECLARED AUDIENCE viewport as featureless background. The cap that
  reads tidy at 1440 is a floating postage stamp at 3840; the
  audience row decides the matrix, and the shell either fills,
  bleeds, or carries a deliberate frame — a beige void on both sides
  is not restraint
- illustration-in-photo-register — a media slot carrying vector
  illustration where the class's exemplar register is photographic
  or composed-scene. Adopting the exemplar's anatomy while
  overriding its load-bearing register is how "payload" rows ship
  clip-art — the divergence is a direction-level decision that
  belongs in the spec's Open calls, not a silent default
- context-rail-on-a-thread — a third-column rail (settings,
  metadata, "about") bolted onto a surface whose center of gravity
  is a single thread or stream; the conversation starves to keep
  the rail alive (the 290px chat pane) — per-page gravity beats
  template uniformity
- a bar satisfiable at the register it exists to prevent — a quality
  bar whose every clause is compositional (contrast math, grid
  arithmetic) and none is the stranger's read passes a 5/10 wash.
  Bars name the read with the tell explicitly banned
- viewport-thin content — ≤2 primary content units visible in the
  first desktop viewport on a content-class surface. Sparse is a
  density decision the spec declares per class, not a side effect
  of an empty data model wearing whitespace as design

## Anatomy contracts — the structural contract per surface class

Grammar describes the house; a contract describes the **register** —
what makes an index table an index table and not a card list wearing
a table header. Before a spec composes a surface class it doesn't
have a contract for, the contract is extracted from ≥2 real exemplars
(same extraction protocol below) and written into the spec's `##
Grammar`. Composing a class from its name alone samples the corpus
prior — "a table" is markup, "an index table" is a contract.

**Index table** (package-index register — PyPI, npm, GitHub Releases
assets, Docker tags):

- Row = **one line**. The primary row carries 4–6 one-line facts
  (name, version, size, downloads, age) at ~40–48px; everything else
  — description, requirements, uploader detail, changelog, install
  steps — lives behind expansion. A second permitted line is a
  single muted meta strip, never a payload column. A table whose
  rows are mini-cards inverted the contract: density is the point.
- Facts live on the line by decision role: decision data (required/
  status, size, version) in view; attribution detail (uploader,
  exact timestamp) may fold first. Shedding order under width
  pressure: ornament and affordance shed first, **decision data
  sheds last** — a REQUIRED marker survives to the narrowest width.
- Header↔cell contract: every labeled column's cell holds what the
  label promises (UPLOADED carries a date, not a name+date), every
  interactive column sits under a header or the header row owns its
  absence deliberately, and empty status cells read as intentional
  (thin, right-aligned, or absent-column), not holes.
- Numeric columns right-align; a sort control only exists where a
  column can display the sorted dimension.
- Below the width where ≥3 real columns can't survive, the honest
  move is the list anatomy — not a one-column table with a
  vestigial header.

**File-library head** (Nexus mod page, GitHub repo file view):

- The head is a **composed region, not a control row**: identity
  (what collection this is) + state (how much is here, how current,
  what's required of the member) + gravity (where the primary
  affordance sits). Controls hang off the composition; a head that
  is only its controls is furniture without a room.

**Release card / media card** (GitHub Releases, Nexus files):

- Desktop anatomy is horizontal: tile | content | action rail.
  Stacked-vertical at desktop reads undeliberated.
- Pinned/state emphasis = border tint + semantic tag + glyph inside
  the title row — never colored edge bars (banned basins).
- Hero cells carry real imagery or a designed typed tile — an empty
  slab is a placeholder wearing a frame.

**Modal / dialog** (settings sheets, confirm dialogs — the grammar's
own chrome-class rules apply: ≤3 sections, no multi-column scroll,
no second chrome class inside the first):

- The modal exists to commit or abandon one focused task — its anatomy
  is head (what this decides) → body (the task's payload, one job) →
  foot (the commit row). A modal doing two jobs is a page wearing a
  scrim.
- Interaction internals are the contract, not options: focus traps
  inside while open (Tab cycles, never escapes to the page), Escape
  and scrim-click dismiss only when the dismissal is *safe* (dirty
  state gets a confirm, never a silent loss), focus returns to the
  invoker on close, and the commit action's weight matches its risk
  (destructive ≠ primary-loud by default).
- Scroll containment is bounded — the modal owns its overflow; the
  page behind does not scroll. Mobile falloff is declared (sheet,
  full-screen, or same), not inherited by accident.

**Filter / dropdown / selector** (list filters, option pickers,
comboboxes):

- The control's job is narrowing a set — its anatomy is closed-state
  (current selection legible at rest, never a bare placeholder),
  open-state (the option list), and applied-state (what's active is
  visible without opening).
- Canonical internals: a search/type-ahead input appears when the
  option count crosses ~10; multi-select shows the selected count or
  chips, never an ellipsis guess; a clear affordance exists whenever
  a selection is applied; keyboard map is complete (ArrowUp/Down,
  Enter, Escape, Home/End); outside-click and Escape close without
  committing partial state.
- Empty-option and loading states are spec'd — a picker that opens
  to a blank box or spins forever failed its contract.

**Button** (the atomic affordance):

- Four roles, four weights — primary (one per region), secondary,
  ghost/tertiary, destructive (its own treatment, never primary-loud).
  A row of equal-weight buttons is an undecided priority.
- Behavior states beyond the visual set: `loading` (spinner or
  disabled-with-progress, never a dead click), `disabled` (with a
  reason available — title, helper text, or obvious context), and
  the click contract declared (navigate / mutate / toggle / submit).
- The label is a verb that predicts the outcome — "Save" commits,
  "Delete" destroys; "OK" and "Submit" are prior-sampling.

**Tabs** (view switchers, channel/panel navigation):

- Tabs switch views of the same subject — they are not filters,
  buttons, or breadcrumbs. The active tab's state is the strongest
  signal in the row (underline/fill/weight per the exemplar), the
  inactive set reads as one affordance family, and the count is
  honest — a tab that produces the same content as its sibling is
  two names for one view.
- Behavior: the row is keyboard-walkable (arrow keys per the tablist
  pattern), the active tab is reachable by state not just position,
  and narrow widths shed or scroll deliberately (scrollable strip,
  overflow menu, or stacked — declared, not clipped).

**Form field** (input, textarea, select, checkbox/radio group):

- Label is always present and associated — placeholder is never the
  label. The field's job (required/optional, format, constraint) is
  legible before focus: helper text where the format isn't obvious,
  required marked the house way.
- State set is complete: rest, focus (visible ring per grammar),
  filled, error (message adjacent to the field, not a toast), disabled
  (with reason), and the validation moment declared (on blur, on
  submit, live) — a field that errors silently or only at submit
  fails its contract.

Extending: a new surface class's contract lands here after its first
validated ship — the doc compounds.

## Anchoring rule — whose bar counts

- **User-praised surfaces are canonical anchors** — a surface the user
  explicitly called high-quality (the board, first and so far canonical)
  is the bar its surface-class gets held to.
- **User-criticized surfaces are negative exemplars** — whatever the user
  rejected goes on the banned list for its class.
- My quality estimate never anchors anything — anchoring on observed
  approval is what closes the self-certification loop.
- **Feedback lands in this file the same session.** A user critique is
  not just a fix request — it is new grammar. Add the criticized
  pattern to the banned list (or amend the grammar block) while the
  session is open, with one line of why. That is how the calibration
  compounds instead of resetting per session.
- **The exemplar is the bar, never the template** (user calibration
  2026-11-03: "match its level of quality, don't steal its design").
  Borrow mechanisms, author expressions — a surface that *reads* like
  the exemplar has failed its concept, not converged on it. See
  `09-design-review.mdc` → resemblance is a delta class.

## The interrogation — the designer's method, run explicitly

Quality here is method, not trait (`13-design-spec.mdc` → the stance).
At spec time and again at review time, run the question set a working
designer runs — every row answered, not skipped:

*Per element:* What is its job (no answer → cut it)? Which voice rank
owns it? Accent-eligible? Which states are missing (empty / loading /
error / filled / hover / long content)? Does it earn its place, or is
it furniture?

*Per surface:* Where does the eye land first — is that the intended
place? Does every element cohere under the concept sentence? What was
added that earns nothing? What would the exemplar's author cut?

A miss is an unmade decision or an uninterrogated element — findable
by method. Never concede a "taste floor"; name the decision or the
open call instead.

## Extraction protocol — when the spec's exemplar isn't here yet

For a surface class with no extracted grammar yet:

1. Pick the exemplar (house surface the user validated, or 2–3 external
   exemplars of the class when the house is silent — referent rule,
   `09-design-review.mdc`).
2. Render it if it exists in-repo — grammar extracted from a screenshot +
   source is artifact-level; grammar from memory is adjectives.
3. Extract per dimension: identity element / voice count + assignments /
   accent budget + which element owns it / affordance shapes / separator
   grammar / micro-copy register / rail or framing grammar / spacing
   values (real px/rem, not "generous").
   Then the two dimensions the petnet/gamersocial failure proved were
   missing:
   a. **Conditions** — under what content/density/realism each
      mechanism works. Restraint reads premium on a dense, real-data
      surface because the CONTENT supplies the texture; the same
      restraint on sparse illustrated content is emptiness. Every
      extracted mechanism names its operating conditions ("quiet
      chrome works BECAUSE the feed is loud"), or the mechanism
      gets adopted outside the envelope it was discovered in.
   b. **Register** — the exemplar's value ranges as NUMBERS, not
      only anatomy: luminance spread across its chrome stack,
      primary-units-per-viewport at desktop width, media register
      (photographic / composed-scene / illustration / abstract),
      chrome loudness (quiet utility vs brand-forward). "Muted" is
      an adjective; "bg→surface→raised spans ~12% rel-luminance,
      tiles are photographs" is checkable.
4. **Extract the refusals, not only the moves.** For the same exemplar,
   enumerate what it declines: how many sections its surfaces max at,
   which chrome classes its family never uses for that job, what density
   it never exceeds, which controls it never shows at rest. The refusal
   list is half the grammar — my generation reaches for mechanisms by
   default, so the list of what the exemplar *doesn't* reach for is the
   binding constraint.
5. Write what the exemplar *doesn't* have — the documented deltas where
   the new surface must invent (these become the spec's Open calls).
   And the divergence flag: overriding an extracted register value
   (the exemplar's tiles are photographs; this surface's are
   illustration) is a DIRECTION-level decision — it lands in the
   spec's Open calls flagged as a taste risk, because the anatomy
   can be adopted while the load-bearing register is silently
   overridden. A divergence the spec never names is the clip-art
   failure wearing the exemplar's features.
6. When a new surface class ships and the user validates it, extract its
   grammar into this file — the doc compounds.

## Usage

At spec time, copy the relevant grammar block into the spec's `## Grammar`
section (adapting values to the surface at hand), then run the banned-
basin list against the `## Inventory` decisions before any code exists.
The grammar conditions composition; it never replaces the per-surface
decisions in the inventory.

**Eyes passes use the bound brief.** `references/eyes-brief.md` is the
repeatable non-producer critique brief — region checklist, distance-to-
referent table, risk re-grade, aesthetic-floor vocabulary, numeric
verdict format. Bind its bracketed slots from the spec + probe artifacts
before launching any rendered-eyes subagent; an unbound brief produces
the generic critique it exists to prevent.

**The level is the bar; the language is a reference, not the only valid
one** (user calibration 2026-11-03: "even the design language doesn't
have to match — the quality is what matters"). What must match is the
level: *deliberateness* (every element's decision made, none defaulted),
*unity* (one concept coheres the surface), *completeness* (states, copy,
edge cases all considered), *honesty* (affordances shaped like their
function, copy doing work not reporting). Where the surface's concept
calls for a different vocabulary than the board's — different voice
structure, different rhythm grammar, different accent logic — author it
at the same concreteness and defend it in the spec's Open calls. A
defended departure is convergence; an undefended one is drift.
