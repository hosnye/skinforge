# SKINFORGE-AutoAccept — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**File:** `Pengu Loader/plugins/SKINFORGE-AutoAccept/index.js`

---

## Summary

A Pengu Loader plugin that automatically accepts League ready-checks when a toggle checkbox is enabled. Behavior mirrors Bocchi's `GameflowMonitor.handleReadyCheck()` exactly: LCU gameflow phase detection → 2-second delay → phase re-verification → accept.

---

## Detection & Accept Flow

The plugin polls `GET /lol-gameflow/v1/gameflow-phase` every **1 second** (only while `enabled = true`).

When the response body is `"ReadyCheck"`:

1. Stop the poll interval (prevent double-trigger).
2. Wait **2000ms** (matches Bocchi's delay exactly).
3. Re-fetch `GET /lol-gameflow/v1/gameflow-phase`.
4. If still `"ReadyCheck"` → `POST /lol-matchmaking/v1/ready-check/accept`.
5. Resume polling (for the next queue).

If the user disables the toggle during the 2-second countdown, the pending timeout is cancelled and the accept is skipped.

**Reference:** `bocchi/src/main/services/gameflowMonitor.ts → handleReadyCheck()`

---

## UI — Lobby Checkbox Injection

A `<div id="sf-auto-accept-wrap">` is inserted into the lobby left panel directly above the summoner icon/name/rank block. Anchor selector cascade (first match wins):

| Priority | Selector | Notes |
|---|---|---|
| 1 | `lol-social-lower-pane-component` | Summoner icon + name + rank block |
| 2 | `.lobby-stats-profile` | Fallback class |
| 3 | `lol-lobby-team-builder-cta-component > :first-child` | Last resort |

Checkbox markup:
```html
<lol-uikit-flat-checkbox class="checked?">
  <input slot="input" type="checkbox" checked?>
</lol-uikit-flat-checkbox>
<span>Auto Accept</span>
```

Label style: Beaufort font, 11px, gold (`#cdbe91`), uppercase, 0.08em letter-spacing.

**Lifecycle:**
- `MutationObserver` on `document.body` (childList + subtree) injects on lobby enter, removes on lobby exit.
- 5-second safety-net `setInterval` calls `tryInject()` in case observer misses a frame.
- Poll interval runs independently — it does not depend on UI injection state.

---

## Persistence

Key: `skinforge-auto-accept`
Default: `false`

Load order:
1. `window.DataStore?.get(key)` — Pengu built-in store
2. `localStorage.getItem(key)` — fallback

Both written on every toggle.

---

## Changes to Existing File

The file `SKINFORGE-AutoAccept/index.js` was scaffolded before this design. Three fixes required:

| What | Old | New |
|---|---|---|
| Detection mechanism | `setInterval(() => querySelector('.ready-check-timer'), 500)` | `setInterval(() => fetch('/lol-gameflow/v1/gameflow-phase'), 1000)` |
| Accept delay | 500ms | 2000ms |
| Phase verification | None | Re-fetch phase before accept; bail if not `"ReadyCheck"` |

Everything else (DataStore persistence, `lol-uikit-flat-checkbox`, MutationObserver) is already correct.

---

## Out of Scope

- No notification/sound when auto-accepted
- No per-queue-type filtering (accepts all queues)
- No countdown display in the UI
