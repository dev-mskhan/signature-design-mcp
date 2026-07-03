Do this for every non-trivial component before generating code. This is
what prevents "looks nice but generic" — physical, specific instructions
produce physical, specific results. Where a component has copy on it
(button label, empty state, error message, tooltip, section heading), write
the **actual words**, in plain language per Universal Rule 1 — not a
placeholder like "CTA text," and never a fabricated data-style label per
Universal Rule 2.

### Step 6 — Spatial Composition

Choose deliberately, don't default to a centered single-column box for
everything. This is the step most often skipped, which is why output
converges on the same squared, centered-card silhouette regardless of the
tone chosen in Step 2 — a rolled shape language for *components* does
nothing if the *page* is still one box in the middle of the screen.

Pick one:
- Asymmetric split (unequal columns, off-center focal point)
- Overlap (elements breaking out of their container, layered z-depth)
- Diagonal flow (content that doesn't sit on a strict horizontal grid)
- Grid-breaking hero (one element deliberately violates the grid to draw focus)
- Full-bleed edge-to-edge (content runs to the viewport edge on at least one side)
- Generous negative space (minimal direction) OR controlled density
  (maximalist direction) — never an accidental in-between

State the pick as a sentence, same as Step 2: **"The page silhouette is
[choice] because [reason tied to the brief]."** If every screen in this
build ends up as a centered rectangle on a plain background, that's a
Step 6 failure even if the colors and fonts are distinctive — go back and
pick a real composition.

### Step 7 — Texture & Depth (only if the tone calls for it)

Consider whether this direction wants: gradient mesh backgrounds, subtle
grain/noise overlay, geometric repeating patterns, layered transparency,
custom cursor, decorative borders. A minimal/brutalist direction should
explicitly reject these. A maximalist/organic/luxury direction often wants
one or two. Never add texture just to add texture — it must serve the tone
chosen in Step 2. Text-based "texture" (a scattering of monospace tags
reading like console output) is never a valid substitute for real visual
texture — this is Universal Rule 2 again, and it doesn't bend for texture
purposes either.

### Step 8 — Self-Critique (before shipping)

- Spend the boldness in ONE place — pick the single signature element this
  screen will be remembered by, keep everything else disciplined around it.
- Chanel test: look at the finished design, remove one accessory/effect that
  isn't earning its place.
- Confirm: responsive down to mobile, visible keyboard focus states,
  `prefers-reduced-motion` respected, WCAG AA contrast on text.
- Confirm real copy was written for every empty/error/success state — no
  lorem ipsum, no generic "Something went wrong." Copy is design material:
  active voice, names things by what the user controls, consistent
  vocabulary through a whole flow.
- **[Universal Rule 1] Read every piece of shipped copy and every label out
  loud.** If anything sounds like a whitepaper, a press release, or a prop
  from a movie — rewrite it in plain words. This check applies to every
  project this skill touches, not just this one.
- **[Universal Rule 2] Scan every label on the page for fabricated data.**
  Any coordinate, status field, spec code, or simulation value not backed
  by Step 1's real-data list gets deleted or replaced with the plain name
  of the thing it labels. This check applies to every project this skill
  touches, not just this one.
- **Count the motion.** Does it match the budget named in Step 3 (one
  signature moment + a small handful of micro-interactions)? If the count
  is 0, add the signature moment back. If nearly everything on the screen
  animates, cut it down to the budget.
- **Look at the page from a distance, ignoring color and type.** Is the
  silhouette just a centered rectangle? If every screen in this build has
  the same box-in-the-middle shape, revisit Step 6 before calling it done.

---

## Variance Enforcement (the part that makes this reusable forever)

This skill is used across MANY unrelated projects. To avoid convergence:

1. **Before Step 2**, briefly note (even mentally) what tone/palette/font/
   silhouette combination was used in the most recent 1–2 projects in this
   session or conversation history, if visible. Deliberately roll a
   different combination unless the new brief specifically calls for the
   same one.
2. Treat the pools in Steps 2/3/6 as dice, not a menu of favorites — resist
   the pull toward whichever option feels "safest" or was used last time.
   This includes the page silhouette in Step 6, not just color/font/tone.
3. If uncertain between two directions, pick the one that feels like a
   slightly bigger risk, then execute it with precision and restraint
   (intentionality beats intensity — a bold choice executed cleanly always
   outperforms a safe choice executed cleanly).
4. Log the final choice at the top of the design-plan document
   (`tone`, `palette strategy`, `font pairing`, `shape language`,
   `page silhouette`, `voice/reading level`, `motion budget`) so future
   projects in the same workspace can be checked against it and
   deliberately diverge.
5. **The two Universal Rules (plain words, no fake data labels) are never
   part of this variance system.** They don't get rolled, they don't get
   varied, and they don't reset between projects or sessions. They apply
   identically on every project this skill is ever used for, forever,
   regardless of industry, tone, or how technical the subject matter is.

---

## Technical Execution Rules

- Every color/font/radius/shadow value comes from CSS custom properties or
  a Tailwind token config — **zero raw hex values or magic numbers in
  component code**.
- Watch CSS selector specificity — type-based selectors (`.section`) and
  element/utility-based selectors (`.cta`) can silently cancel each other;
  keep spacing/padding rules unambiguous per component.
- Match implementation complexity to the chosen vision: a maximalist
  direction earns elaborate animation/effect code; a minimalist direction
  earns restraint — precision in spacing and type, not extra code. Either
  way, motion stays inside the Step 3 budget regardless of how elaborate
  the visual direction is.
- Take a screenshot / visually inspect your own output if the environment
  allows it, and critique it against Step 8 before calling the work done.

---

## Output Format When Starting a New Project

Before writing component code, produce a short **design-plan doc** stating:
1. Subject / audience / single job / emotional arc / reading level / real
   data available (Step 1)
2. Chosen tone + one-sentence justification (Step 2)
3. Full token spec — color roles with hex, font roles with names, voice and
   copy rules (words we use / words we avoid / labels we don't invent),
   shape rules per component type, shadow system, motion system with an
   explicit budget (Step 3)
4. Anti-pattern gate — explicitly confirm each checkbox, including both
   Universal Rule checks, the motion check, and the silhouette check (Step 4)
5. Page-level silhouette + one-sentence justification (Step 6)
6. The one signature element this build will be remembered by (Step 8)

Only after this plan is written and reviewed against Step 4 should
component/page code generation begin.
