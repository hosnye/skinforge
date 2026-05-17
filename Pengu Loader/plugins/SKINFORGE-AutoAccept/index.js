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
      #${WRAP_ID} {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin: 0 auto 12px;
        padding: 6px 16px;
        width: fit-content;
        background: rgba(1, 10, 19, 0.78);
        border: 1px solid #463714;
        border-radius: 2px;
        cursor: pointer;
        user-select: none;
        position: relative;
        z-index: 50;
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
    // Primary: the player banner card (icon + name + rank — the "profile area")
    const banner = lobby.querySelector('.v2-banner-component')
    if (banner && banner.parentElement) {
      return { parent: banner.parentElement, before: banner }
    }
    // Fallback: as first child of the parties view
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
    anchor.parent.insertBefore(buildCheckbox(), anchor.before)
    console.log(LOG, 'checkbox injected above .v2-banner-component')
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
