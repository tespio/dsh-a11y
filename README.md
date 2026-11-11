# dsh-a11y

Accessibility layer for the DeepSeek Harness Web UI. This is **v1**: the
announcement coordinator, keyboard navigation, and an Accessibility settings
page. The v2 author kit (`ctx.a11y`, `<LiveRegion>`, `useFocusTrap`,
`useRovingTabIndex`, `auditSubtree`) is deliberately **not** part of this build.

The plugin adds coverage; it does not replace the shipped chat UI.

**Presentation:** [PPTX](docs/dsh-a11y-presentation.pptx) · [PDF](docs/dsh-a11y-presentation.pdf)

## Related work and the gap check (2026-11-11)

The bare npm name `dsh-a11y` is still unclaimed (`npm view dsh-a11y` → 404),
but the brief's "no accessibility plugin exists" premise is stale:

- [`@oh-my-dsh/dsh-accessibility`](https://www.npmjs.com/package/@oh-my-dsh/dsh-accessibility)
  (published `0.1.0-beta.3`, repo `omdsh-dev/dsh-accessibility`) is a
  present-day companion with a Settings → Accessibility **diagnostic**, a
  screen-reader guide, and an experimental **Accessible View** reading tab. Its
  published line targets DSH `0.1.1-rc.2`/`0.1.2-rc.1`; the repo's migration
  candidate targets `0.2.0-rc.2`. Its own README states that it "cannot safely
  replace focus traps, composite-widget keyboard behavior, landmarks, or
  live-region policy from outside the owning components."
- [`dsh-a11y-scan`](https://github.com/988hj7tczd-oss/dsh-a11y-scan) runs
  axe-core over local HTML, build output, or URLs. It is a content scanner, not
  a UI live-announcement layer.

`dsh-a11y` targets the installed DSH `0.2.2-rc.1` and fills the specific gap
the other two leave: a **coordinated announcement layer** for tool lifecycle,
approvals, and questions, plus skip/latest navigation and the announcement
settings. It overlaps the diagnostic/settings surface only partially.


## Install

```powershell
# From the workspace root:
#   plugin_manager -> install_bundle -> C:\...\default-workspace\dsh-a11y
```

The bundle has a no-op Host half (`index.js`) and a browser half
(`client.js`, declared by `package.json`'s `dsh.client`). It installs as a normal
profile bundle; no `app.asar` edits are involved.

## What the host already announces (do not duplicate)

Verified against the shipped `@deepseek-ai/dsh-client-ui-chat` 0.2.2-rc.1
bundle, `lib/client.js`:

| Moment | Host component | Live-region markup | Text |
| --- | --- | --- | --- |
| Turn start | `RunningStatus` | `span.visuallyHidden[role=status][aria-live=polite][aria-atomic=true]` | `chat.deepDiving` ("Deep diving") |
| Turn end | `TurnProcessNodeView` | `span.visuallyHidden[role=status][aria-live=polite][aria-atomic=true]` | `message.turnProcess.worked` / `message.stopped` / `message.turnProcess.failed` |
| Retry countdown | `ModelRetryItem` | `span[role=status]` (implicit polite) | `message.retry.status` |
| Terminal turn error | `TurnErrorItem` | `div[role=status]` (implicit polite) | `message.turnError` / `message.taskStopped` + failure text |
| Token cap | `TurnMaxTokensItem` | `div[role=status]` (implicit polite) | `message.maxTokens` |

Tool rows also render visually-hidden `row.running` / `row.failed` text, but
those spans are **not** live regions; adding/removing them does not announce on
its own. That is part of the gap this plugin fills.

### How dsh-a11y coordinates

`dsh-a11y` never emits turn start or turn end announcements. Its only live
regions are the new pair in `shell.overlay` (polite + assertive). Turn start,
turn end, retry, terminal turn errors, and token-cap notices stay owned by the
host regions above. This was a deliberate "stay silent" choice, not blind
muting: the host's two `role="status"` regions are visible in the installed
chat component and their copy was verified from both the installed package and
the extracted app bundle.

If the host later removes those regions, this plugin becomes the only coverage
for tool activity, approvals, and questions, but turn start/end would need a
follow-up.

## Announcements

Source: Client state only.

- **Tool started** — `useChat(snapshot => snapshot.legacy.runningCalls)`,
  announced when a call reaches `phase === 'start'` (preparing calls stay
  silent).
- **Tool finished / failed** — `useChat(snapshot => snapshot.legacy.nodes)`,
  correlated by `callId` with the running call. Failure is `isError: true`;
  the detailed summary comes from `error.reason` / `error.code` / the first
  text block, truncated to 96 characters.
- **Approval requested** — `useSessionStatus(...).pendingInteraction` with
  `kind === 'approval'`; assertive. The tool name and request reason are
  included.
- **Question asked** — the same pending-interaction source with
  `kind === 'question'` or `kind === 'plan-review'`; assertive.
- **Settings test** — the Test button in the Accessibility page pushes a
  forced polite announcement so users can verify the route to their screen
  reader.

Streaming assistant tokens are never announced. Announcements are triggered by
state transitions, not by render counts or token deltas.

Announcements follow the Chat transcript target. In the Trajectory view the
Chat target may not be materialized, so tool transitions can be unavailable
there; the host's own turn boundary regions have the same dependency. This is a
known v1 limitation.

### Verbosity and merging

- **Off** — no polite announcements. Focus management still runs. The Test
  button still works.
- **Concise** — "Tool bash started", "Tool bash finished", "Tool bash failed",
  approvals and questions.
- **Detailed** — finished results include a short result summary and duration
  ("Tool read finished in 0.4 seconds. package.json").

Fast tools are merged in the queue: a still-queued start is replaced by its
finish, so a 50 ms tool is spoken once, not twice. The announcement speed
setting controls the gap between queued messages (250 / 700 / 1400 ms). The
queue is capped at 30 items, and identical consecutive text is alternated with
a zero-width space so screen readers do not suppress a repeat.

History paging does not replay old tools: the coordinator primes a sequence
watermark on mount and only treats newer `tool-result` nodes as live. A tool
that was already running when the session opened still gets its finish
announced.

## Navigation

- **Skip link** — a visually hidden "Skip to conversation" link is the first
  Tab stop from the document root. The plugin captures the first Tab when
  nothing is focused and focuses the link; Enter (or the next Tab) lands on the
  latest turn boundary inside the transcript, falling back to the composer
  input when there is no turn yet. The link becomes visible when focused.
- **Landmarks** — the skip link sits in a labelled `nav`; the jump button sits
  in a "Conversation navigation" `nav`; the settings page is a labelled
  `section`.
- **Per-turn headings** — each completed turn contributes an
  `h2` ("Turn 3: completed") in `conversation.chat.turnTail`. It is visually
  hidden, `tabIndex=-1`, and is the focus target used by the skip link. The
  latest turn's heading carries `id="dsh-a11y-turn-latest"`.
- **Jump to latest turn** — a compact button in `conversation.composer.dock`
  focuses the most recent visible turn heading.
- **Approval focus** — when an approval becomes pending, the plugin stores the
  previously focused element, moves focus to the approval card's detail group
  (the host card has no focus move of its own), and on settlement restores the
  previous focus target, or the composer input.
- **Focus ring** — the Accessibility settings page can add a 3 px brand-colored
  `:focus-visible` outline to every control.

The host settings panel already uses its `useModalLayer` primitive for the
dialog focus trap and focus restore; the plugin does not add a second trap
inside it. Only the approval takeover needed a focus move and restore, which the
coordinator supplies.

Known limitation: the plugin cannot own the transcript container. The host
offers no additive slot at the *start* of the transcript, so the skip target and
per-turn headings live at turn boundaries (turn tails). Per-turn headings are
therefore navigable in the heading list but describe a turn from its end.
Fixing that properly needs a host change (see "Host findings").

## Settings

The Accessibility page is its own `settings.section` (`id: accessibility`,
order 30) with:

- Announcements: Off / Concise / Detailed.
- Announcement speed: Fast / Normal / Slow.
- Focus ring: Default / Emphasized.
- Motion: Follow system / Reduce motion / Allow motion.
- Text size: 12–22 px, delegated to the host's `theme.setFontSize('text', px)`
  so it is the same preference as Appearance → Text size.
- Test announcement and Reset preferences.

Preferences other than text size are stored in `localStorage` under
`dsh-a11y.settings.v1`. They are browser-local, normalized on read, and applied
through `data-dsh-a11y-focus` / `data-dsh-a11y-motion` on the document root.
There is no Host Config in v1, so nothing is written to the profile patch.

Motion override:

- **Follow system** leaves the host's existing `prefers-reduced-motion` media
  queries untouched.
- **Reduce motion** forces near-zero animation and transition durations on the
  document, including when the OS preference is off.
- **Allow motion** restores short transitions (150 ms) and 1 s animations when
  the OS preference is on. This is intentionally a broad, opt-in override; it
  is documented as such because it deliberately contradicts the OS.

All styles use `--dsw-alias-*` color tokens. The only other values are spacing,
type sizes, and radius fallbacks.

## Verification status (this build)

Installed with `plugin_manager install_bundle` into the current profile;
`application: applied`, no warnings. Live client registration was confirmed by
`cordis_inspect_query`:

- `settings.section` → occupant `accessibility`, order 30, active.
- `conversation.composer.dock` → occupant `a11y-coordinator`, order 2, active.
- `shell.overlay` → occupants `a11y-skip-link` and `a11y-announcer`, active.
- `conversation.chat.turnTail` → occupant `a11y-turn-heading`, order 1000,
  active.

Not verified in this environment: no browser-control or screen-reader
automation was available, so the rendered settings page, Narrator/NVDA speech,
zoom, and axe results remain **manual**. Automated tests cover the formatter,
queue merging, settings normalization, and locale parity:

```powershell
node test/run.mjs
# or, in a shell that expands globs:
node test/*.mjs
```

## Manual test protocol

1. **Turn start/end, no double-speak.** With Narrator or NVDA, send a prompt
   with 3+ tool calls. You should hear "Deep diving" at start and one
   worked/stopped/failed turn-end message, never a second "Turn started" or
   "Turn finished" from this plugin.
2. **Concise.** At Concise, each tool's start and finish is distinguishable by
   tool name; failures say "failed".
3. **Detailed.** Switch to Detailed and confirm finished messages include a
   result summary and duration.
4. **Approvals.** Trigger a tool that requires approval. You should hear the
   assertive approval announcement, focus should land in the approval card, and
   after answering, focus should return to the composer (or the previously
   focused control).
5. **Questions.** Trigger a question and confirm one assertive question
   announcement; the host question composer already autofocuses its input.
6. **Skip link.** Reload with no focus. Press Tab once: the skip link appears.
   Press Enter (or Tab again): focus lands at the latest turn boundary; the
   screen reader reads the turn heading.
7. **Keyboard only.** Start a session, send, stop, approve, and switch sessions
   without a mouse. With the focus-ring setting on Emphasized, every control
   should show a visible outline.
8. **Reduced motion.** Set OS reduced motion on, choose Allow motion, and
   confirm host transitions return; then choose Reduce motion with the OS
   preference off and confirm they collapse.
9. **Zoom and width.** Browser zoom 200% and a 320 px viewport: the
   Accessibility page rows stack; selects and buttons do not clip.
10. **axe.** Run axe-core over the app shell. Plugin-owned surfaces should have
    zero critical violations. Host findings below are recorded, not silently
    patched.

## Host findings (for the DSH team)

These are host-level gaps observed while building this plugin. They are not
fixed by global CSS or DOM hacks here.

1. **No skip link.** The shell has no "skip to main content" control. The
   plugin can only put its link in `shell.overlay`, which is after the main
   content in DOM order; the first-Tab focus is implemented with a capture
   handler.
2. **No additive slot at the start of the transcript.** Turn tails are the
   earliest plugin-owned position inside the chat flow, so per-turn headings
   describe a turn from its end and the skip target is the latest turn
   boundary. A `conversation.chat.turnHead`/turn-start list slot (or a
   transcript-start anchor slot) would make this correct.
3. **Approval card has no dialog/landmark/live region and no focus move.**
   `ApprovalPanel` renders a warning strip and buttons inside the composer
   takeover but does not focus it; `dsh-a11y` supplies the announcement and
   focus move. A `role="region"`/`aria-labelledby` and focus move in the host
   would remove the need for both.
4. **Tool lifecycle is silent.** `row.running` / `row.failed` are visually
   hidden but not live regions. The host could own a single polite tool
   announcer; until then this plugin does.
5. **Question and plan-review cards expose only error `role="status"`.** The
   question text itself is not announced when the card appears. The composer
   autofocuses its input, which mitigates but does not cover a pending card
   that appears while focus is elsewhere.
6. **`role="status"` is used for several unrelated notices** (retry, turn
   error, token cap) without an explicit `aria-live`; behavior depends on the
   screen reader. A consistent polite/assertive policy would help.
7. **Heading order in the shell is uneven.** There is no single main landmark
   in the frame; the center column and rightbar are generic containers. A
   `<main>` around the active panel would give screen readers a reliable
   landmark.
8. **Focus ring styling is per-component.** Most controls have a visible
   focus style, but the plugin's Emphasized setting is still useful because
   some host controls inherit only a subtle outline.

## Build caveat

During this build the harness's automatic report-card measurement ran right
after the bundle was installed, and the linked source directory was emptied
shortly afterwards. The source was restored from the build session; the profile
junction resolves to the restored files and the client registers again. If you
reinstall or bump the version, keep a copy of this directory first: the
automatic measurement of a `link:` bundle is the observed trigger.

The generated card (`@local/dsh-a11y@0.1.0`) was left in place.

## v2 (not in this build)

The author kit remains the next step:

- `ctx.a11y` provided by this package, with `announce()`, `<LiveRegion>`,
  `useFocusTrap`, `useRovingTabIndex`, and `auditSubtree(ref)`.
- The audit panel that runs the kit against a plugin's own slot and produces
  pass/fail paths plus a manual checklist.
- Tests for the audit rules against fixture DOM.

`ctx.provide()` is available to a Client half, so `ctx.a11y` is feasible. The
kit must audit only the caller's own subtree, never a foreign plugin's DOM.

## Package layout

| File | Purpose |
| --- | --- |
| `index.js` | Host half, no-op in v1. |
| `client.js` | Browser half: dictionaries, bus, coordinator, skip link, turn headings, settings page. |
| `cordis.patch.yml` | Inserts the `dsh-a11y` Host row. |
| `locale/en.json`, `locale/zh.json` | Plugin Manager metadata and the same strings as the runtime dictionaries. |
| `icon.svg` | Bundle icon. |
| `test/*.mjs` | Formatter, queue merging, normalization, locale parity. |
