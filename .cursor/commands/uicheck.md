### 1. Goal

Perform a focused design QA pass on the current page across desktop, tablet, and mobile breakpoints. Detect obvious UI issues, auto-fix only safe and unambiguous ones, and list all subjective or non-obvious improvements separately.

---

### 2. Workflow

1. Load the current page in the browser tool.
2. Capture and inspect screenshots at three views:
   - Desktop (~1280px+ width)
   - Tablet (~768–1024px width)
   - Mobile (~375–430px width)
3. For each breakpoint, evaluate:
   - Layout & responsiveness (no broken or collapsing layouts)
   - Spacing & alignment (consistent spacing, clean grids)
   - Typography (readability, hierarchy, line length, line height)
   - Contrast & color (WCAG-ish contrast, legible on light/dark backgrounds)
   - Overflow & truncation (no random clipping, sensible truncation)
   - Component consistency (buttons, cards, badges, etc.)
   - Accessibility basics:
     - Tap/click targets ~44x44px minimum where practical
     - Focus states visible for interactive elements
     - Interactive icons are discoverable and have titles/tooltips where needed
4. Create a quick internal TODO list of issues and classify each as:
   - **Obvious / objective / rules-based** (safe to auto-fix)
   - **Subjective / design-intent-dependent** (suggest only)
5. Apply code changes **only** for obvious, low-risk issues using minimal, targeted edits.
6. Prefer editing existing utility classes / CSS over large refactors.
7. After applying fixes, re-check the affected breakpoint(s) in the browser to verify no regressions.
8. Produce the final report in the required output format, without narrating your steps or intermediate thoughts.

---

### 3. Auto-Fix Rules

**Auto-fix ONLY when all of these are true:**

- The issue is clearly wrong under standard UI/UX practices.
- The fix is unambiguous and low-risk.
- The change is local, minimal, and does not alter overall layout intent.

Examples of acceptable auto-fixes:

- Misalignment or uneven spacing within a section or component.
- Text too close to edges; add padding/margin to match existing spacing scale.
- Overflow or unintended scrollbars from obvious layout mistakes.
- Elements overlapping or clipping in a way that clearly breaks readability.
- Broken flex/grid behavior (e.g., items smashed into one column on mobile when they should stack).
- Inconsistent padding/margins vs. rest of the design system.
- Poor or unreadable contrast on text or critical UI elements.
- Font sizes or line-heights that clearly hurt readability (e.g., tiny text on mobile).
- Very small tap targets for key controls; bump to at least ~44x44px where reasonable.

**DO NOT auto-fix** anything that is subjective or requires guessing about design intent, including:

- Typography choices (font family, broad size scale changes).
- Color palette changes beyond pure contrast fixes.
- Global spacing scale changes or full layout reflows.
- Structural redesigns of sections, grids, or navigation.
- Adding new components or redesigning information architecture.

When in doubt, treat it as **subjective** and put it in Suggestions.

---

### 4. Suggestions Rules

For all non-obvious or subjective issues, create a **Suggestion** entry.

Each suggestion should include:

- What the issue is.
- Why it matters (e.g., readability, scanning, visual hierarchy, accessibility, consistency).
- A short recommended direction for improvement, aligned with common UI/UX heuristics.

Do **not** include code for suggestions unless explicitly requested by the user; keep them at the level of design guidance.

---

### 5. Output Format (STRICT)

Respond with **only** the following sections and structure. Do not include narration like “reviewing code” or “loading page,” and do not show reverted or intermediate edits—only final, current code.

```md
## Auto-Fixes

### [Breakpoint] – [File or Component Name]
- Issue: [short description]
- Reason: [why this was clearly wrong and safe to fix]
- Fix:
```diff
[minimal diff showing only the relevant changes]
````

### [Next Breakpoint / Component...]

* Issue: ...
* Reason: ...
* Fix:

```diff
[diff]
```

(If no auto-fixes were applied, write: `None.`)

## Suggestions (Not Auto-Fixed)

* [Breakpoint] – [Short issue description] → [why it matters + suggested direction]
* [Breakpoint] – [Short issue description] → [why it matters + suggested direction]

(At least a few high-value suggestions if any exist.)

## Verification

* Checked breakpoints: [desktop / tablet / mobile]
* Notes: [Very short confirmation that no obvious regressions were seen after fixes, or “N/A”]

```

---

### 6. Style & Scope

- Be concise and surgical.
- Do not alter business logic or data flow; focus only on layout, styles, and markup-level issues.
- Prefer consistency with the existing design system (e.g., Tailwind/DaisyUI utility patterns already in use).
- Avoid duplicating large blocks of unchanged code in diffs—show only what changed.
