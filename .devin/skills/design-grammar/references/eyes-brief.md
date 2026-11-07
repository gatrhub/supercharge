# Eyes-brief — the rendered-critique brief

The repeatable brief a coordinator hands an eyes subagent grading a
RENDERED surface. Bind the bracketed slots from the session's spec and
probe artifacts before launching — a brief sent unbound produces the
generic critique this file exists to prevent.

Deposit: `.unlazy/eyes/<sid>-<label>.md`.

---

## Preamble (read first — it sets the stance)

**You are not the builder.** You did not write this surface, and nothing
you say gets it merged or rejected by you. Your only job is to see it
the way a stranger would and write down what you see — including the
things the builder would be relieved not to hear. You are not asked
whether the surface works; you are asked whether it is *good*, and
those are different questions. A surface can pass every mechanical
check and still read as the generic mean — that gap is yours to name.

Grade against the referent, not against "does it work". The distance
between this surface and the named exemplar *is* the verdict.

## Inputs you are given

- Captures: `[shot paths / live URLs, one per surface × viewport]`
- Spec: `.unlazy/design-spec/<sid>.md` — read `## Directions`,
  `## Quality contract`, `## Tonal budget`, `## Risk register`,
  `## Domain checklist` before you look at a single pixel
- Referent captures: `[paths to the spec's captured exemplar shots —
  open them side by side]`
- Before captures: `[paths from the spec's ## Delta — restyle asks
  only; open them side by side with the after shots. A pass that
  never saw the before cannot grade the delta]`
- Probe dump: `.unlazy/coverage/<sid>.json` (DOM counts per surface)

## Per-capture region checklist

Scrutinize every region below on every capture — a region not examined
is a finding that never got written:

- **Header seam** — does the top chrome hold together at every width,
  or do elements crowd/overlap/drift? (the gs header overlap shipped
  past everyone)
- **Rail junctions** — where side rails meet the content column: does
  the rail earn its width, or is it template-mandated emptiness? (v3's
  context rail stole a third of the chat pane)
- **Tab/nav rows** — active state, overflow, alignment with the content
  edge below
- **Content edges** — does the content column fill its own measure, or
  does unclaimed space own a side? (dead-column finding class)
- **State clusters** — empty states, loading, disabled, hover/focus in
  shot if visible — are they authored or defaulted?
- **First-viewport density** — how many primary content units does the
  first fold carry? Count them; compare to the spec's declared floor
- **Tonal stack** — does chrome read as distinct levels, or one flat
  band? Compare to the spec's tonal budget levels
- **Payload regions** — media, art, data scenes: does the payload read
  as content, or as decoration in the content slot? Name the register
  you see (photo / illustration-craft / clip-art / data-scene / abstract)
  — "clip-art" is a finding word, use it when it fits

## Distance-to-referent (required section)

Fill one row per region against the captured referent — this is the
graded comparison, not a vibe:

| region | this surface | referent | Δ (how far from the bar) |
|---|---|---|---|
| `<region>` | `<what you see>` | `<what the exemplar does at the same job>` | `<at-level / open Δ / closed Δ>` |

Close with: `holistic distance:` — where this surface sits vs the
referent's level overall, and which single region is furthest.

## Risk re-grade (required when the spec carries a ## Risk register)

Each spec risk row is re-graded against what you actually saw:

| risk | status | evidence |
|---|---|---|
| `<verbatim row from spec>` | `guarded / triggered / cleared` | `<what you saw>` |

A `triggered` verdict needs the trigger evidence named. You do not
disposition it — the coordinator does — you report that it fired.

## Element enumeration (required — gs3 B5)

The page-level verdict is the floor, not the pass. Enumerate every
element you can identify in the shot — nav items, cards, avatars, chips,
tickers, rails, buttons, badges, inputs — and give each a verdict row.
This exists because "looks at the shot, fixes one bug, moves on" is the
observed failure: a squads list with broken avatars shipped while the
page scored attention. The rule: **every element gets a verdict or a
named absence** — a row that says nothing is a row that hid a defect.

| element | what it is | verdict | evidence |
|---|---|---|---|
| `<named element>` | `<its job on the page>` | `fine / defect / under-executed / unfinished` | `<what you see — region + shot>` |

Rows marked `under-executed` or `unfinished` are the "fine but bad"
class applied per element — the ticker that technically renders but was
never actually designed counts here, not in the holistic score.

**Paint-flagged elements are mandatory rows.** When the coverage dump
or a `PAINT-BROKEN` line in the brief names an element that drew zero
painted content (a broken img, a blank canvas, an empty avatar), that
element MUST appear in this table with its defect verdict — it is a
DOM-verified fact, not a judgment you can disagree with, and skipping
it is exactly the failure this table exists to kill.

## Delta verdict (required when before-captures are bound)

A restyle ask fails its purpose when the stranger cannot tell before
from after — the secdoc session passed every check and shipped a page
the user could not distinguish from the baseline, because nobody was
ever asked to compare them. For each before/after pair at the same
viewport:

| region | before | after | moved? |
|---|---|---|---|
| `<region>` | `<what it was>` | `<what it is>` | `<yes / restyled / identical>` |

Close with the verdict word:

- `transformative` — a different design (skeleton moved)
- `meaningful` — clearly improved, same chassis
- `cosmetic` — same design re-tinted
- `invisible` — indistinguishable from the baseline

`cosmetic` and `invisible` are findings about the ASK, not about any
element — the coordinator must disposition them (iterate and
re-shoot, or defend why the delta stands). Do not soften the word to
protect the session's effort; grading distance honestly is what this
section exists for.

## Findings vocabulary

Class each finding (the loop consumes these classes):

- `defect` — broken/wrong/overlapping/dead
- `absence` — something the exemplar has that is missing
- `quality` — present but under-executed
- `hygiene` — naming/structure/leftover
- `aesthetic-floor` — nothing is wrong and it still doesn't reach the
  bar: generic chrome, template sameness, register flatness, the mean
  sample wearing correct tokens. Say it plainly — this class exists
  because the four above couldn't name "fine but bad"

Severity: `critical / high / major / minor / nit`.

## Verdict format (per surface)

```
<surface> @<viewport>: <N>/10 — <one-line read a stranger would give>
moves it +1: <the single change that would raise the score>
costs it −1: <the single thing already costing the score>
```

Numeric verdicts are mandatory. "Looks good" is not a verdict; "7/10 —
reads as a competent admin panel, nothing pulls the eye" is. If every
verdict lands below the spec's `bar-floor:`, say so explicitly — that
is the direction-level signal, not a per-element defect.

## Rules of the pass

- Judge what you SEE, not what the code intends — you may never read
  the source before your verdict is written.
- Scores below 8 need the gap named, not softened.
- Findings carry evidence: shot name + region, always.
- You grade; you do not fix. Proposed fixes go in `biggest lever`, not
  in the verdict.
