# Build notes

## Linked-source cleanup after installation

During the 2026-11-11 build of this package, the harness's automatic
report-card measurement ran immediately after `plugin_manager install_bundle`.
The linked source directory was emptied shortly afterwards.

The source was restored from the build session; the profile junction now
resolves to the restored files, and the client re-registered successfully
(all six slot registrations came back active after a page reload).

Practical consequence: keep a copy of this directory before reinstalling or
bumping the version of a `link:` bundle in this profile. The generated card
(`@local/dsh-a11y@0.1.0`) was left in place.

## Verification performed for this build

- `node test/run.mjs` — announcement formatting, queue merging, settings
  normalization, and locale parity.
- React server-render smoke test — skip link, live regions, turn heading,
  coordinator, full settings markup, icon; labels/IDs/`aria-describedby`
  checked.
- Apply smoke test — six slot registrations, global attributes, style
  injection, and disposal.
- Live `cordis_inspect_query` — `settings.section` (`accessibility`),
  `settings.section.icon`, `conversation.composer.dock`
  (`a11y-coordinator`), `shell.overlay` (`a11y-skip-link`,
  `a11y-announcer`), and `conversation.chat.turnTail`
  (`a11y-turn-heading`) active after reload.

Not verified automatically: Narrator/NVDA speech, real 200% zoom / 320 px
layout, and axe-core over the app shell. See the manual protocol in
`README.md`.
