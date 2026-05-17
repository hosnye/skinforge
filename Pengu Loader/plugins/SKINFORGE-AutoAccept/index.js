(function initAutoAccept() {
  'use strict'

  const LOG = '[SF-AutoAccept]'
  const STORE_KEY = 'skinforge-auto-accept'
  const POLL_MS = 1000
  const ACCEPT_DELAY_MS = 2000
  const WRAP_ID = 'sf-auto-accept-wrap'
  const LOBBY_SCREEN = 'rcp-fe-lol-parties'

  // ── State ──────────────────────────────────────────────────────────────────
  let enabled = false
  let pollInterval = null
  let acceptTimeout = null
  let lobbyObserver = null

  // ── Persistence ────────────────────────────────────────────────────────────
  async function loadSetting() {
    try {
      const raw = await window.DataStore?.get(STORE_KEY)
      if (raw != null) return raw === true || raw === 'true'
    } catch (_) {}
    try {
      const ls = localStorage.getItem(STORE_KEY)
      if (ls != null) return ls === 'true'
    } catch (_) {}
    return false
  }

  function saveSetting(val) {
    try { window.DataStore?.set(STORE_KEY, val) } catch (_) {}
    try { localStorage.setItem(STORE_KEY, String(val)) } catch (_) {}
  }

  // ── LCU gameflow phase ─────────────────────────────────────────────────────
  async function getGameflowPhase() {
    try {
      const res = await fetch('/lol-gameflow/v1/gameflow-phase')
      if (!res.ok) return null
      return (await res.text()).replace(/"/g, '').trim()
    } catch (_) {
      return null
    }
  }

  // ── Auto-accept (mirrors Bocchi's GameflowMonitor.handleReadyCheck) ────────
  function startPoll() {
    if (pollInterval) return
    pollInterval = setInterval(checkReadyCheck, POLL_MS)
  }

  async function checkReadyCheck() {
    if (!enabled) return
    const phase = await getGameflowPhase()
    if (phase !== 'ReadyCheck') return
    if (acceptTimeout) return

    acceptTimeout = setTimeout(async () => {
      acceptTimeout = null
      if (!enabled) return

      const verifyPhase = await getGameflowPhase()
      if (verifyPhase !== 'ReadyCheck') {
        console.log(LOG, 'phase changed during delay — skipping accept')
        return
      }

      try {
        await fetch('/lol-matchmaking/v1/ready-check/accept', { method: 'POST' })
        console.log(LOG, 'accepted')
      } catch (e) {
        console.warn(LOG, 'accept failed', e)
      }
    }, ACCEPT_DELAY_MS)
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  function ensureStyles() {
    if (document.getElementById('sf-aa-styles')) return
    const style = document.createElement('style')
    style.id = 'sf-aa-styles'
    style.textContent = `
      .lobby-banner.local { position: relative !important; }
      #${WRAP_ID} {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 4px 12px;
        white-space: nowrap;
        background: rgba(1, 10, 19, 0.85);
        border: 1px solid #463714;
        border-radius: 2px;
        cursor: pointer;
        user-select: none;
        z-index: 100;
        transition: background-color 120ms ease, border-color 120ms ease;
      }
      #${WRAP_ID}:hover {
        background: rgba(40, 30, 12, 0.9);
        border-color: #785a28;
      }
      #${WRAP_ID} .sf-box {
        width: 14px;
        height: 14px;
        border: 1px solid #785a28;
        background: #010a13;
        position: relative;
        flex-shrink: 0;
      }
      #${WRAP_ID}.on .sf-box {
        border-color: #c8aa6e;
      }
      #${WRAP_ID}.on .sf-box::after {
        content: '';
        position: absolute;
        inset: 2px;
        background: #c8aa6e;
      }
      #${WRAP_ID} .sf-label {
        font-family: "Beaufort for LOL", "LoL Display", serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #a09b8c;
      }
      #${WRAP_ID}.on .sf-label {
        color: #f0e6d2;
      }
    `
    document.head.appendChild(style)
  }

  function buildCheckbox() {
    const wrap = document.createElement('div')
    wrap.id = WRAP_ID
    if (enabled) wrap.classList.add('on')

    const box = document.createElement('div')
    box.className = 'sf-box'

    const label = document.createElement('span')
    label.className = 'sf-label'
    label.textContent = 'Auto Accept'

    wrap.appendChild(box)
    wrap.appendChild(label)

    wrap.addEventListener('click', (ev) => {
      ev.stopPropagation()
      enabled = !enabled
      wrap.classList.toggle('on', enabled)
      saveSetting(enabled)
      if (!enabled && acceptTimeout) {
        clearTimeout(acceptTimeout)
        acceptTimeout = null
      }
      console.log(LOG, 'toggled →', enabled)
    })

    return wrap
  }

  // ── Lobby DOM injection ────────────────────────────────────────────────────
  function findLobbyRoot() {
    return document.querySelector(`.screen-root[data-screen-name="${LOBBY_SCREEN}"]`)
  }

  function findAnchor(lobby) {
    // Primary: as first child of the local player's banner card
    // (the dark gold card holding icon/name/rank — checkbox sits above the icon)
    const card = lobby.querySelector('.lobby-banner.local')
    if (card) {
      return { parent: card, before: card.firstChild }
    }
    // Fallback 1: as first child of the v2-banner wrapper
    const banner = lobby.querySelector('.v2-banner-component')
    if (banner) {
      return { parent: banner, before: banner.firstChild }
    }
    // Fallback 2: as first child of the parties view
    const view = lobby.querySelector('.parties-view')
    if (view) {
      return { parent: view, before: view.firstChild }
    }
    return null
  }

  function tryInject() {
    if (document.getElementById(WRAP_ID)) return true
    const lobby = findLobbyRoot()
    if (!lobby) return false
    const anchor = findAnchor(lobby)
    if (!anchor || !anchor.parent) return false
    ensureStyles()
    // Force positioning context on the parent so our absolute checkbox
    // anchors to the banner card and not the viewport. Inline style wins
    // against any League-internal CSS specificity.
    anchor.parent.style.position = 'relative'
    anchor.parent.insertBefore(buildCheckbox(), anchor.before)
    const rect = anchor.parent.getBoundingClientRect()
    console.log(LOG, 'checkbox injected; parent rect:', Math.round(rect.left), Math.round(rect.top), Math.round(rect.width) + 'x' + Math.round(rect.height))
    return true
  }

  function startLobbyObserver() {
    if (lobbyObserver) return
    lobbyObserver = new MutationObserver(() => {
      const lobby = findLobbyRoot()
      if (lobby) {
        tryInject()
      } else {
        // Lobby unmounted — Ember already removed our element, nothing to clean up
      }
    })
    lobbyObserver.observe(document.body, { childList: true, subtree: true })
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    enabled = await loadSetting()
    console.log(LOG, `init — auto-accept ${enabled ? 'ON' : 'OFF'}`)

    startPoll()
    startLobbyObserver()
    // Safety net: try injection every 3 s in case the observer misses a frame
    setInterval(tryInject, 3000)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
