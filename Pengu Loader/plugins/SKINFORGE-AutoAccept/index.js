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

  // ── Toggle UI (styled like .open-party-toggle, placed beside it) ───────────
  function ensureStyles() {
    if (document.getElementById('sf-aa-styles')) return
    const style = document.createElement('style')
    style.id = 'sf-aa-styles'
    style.textContent = `
      #${WRAP_ID} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 12px;
        margin-right: 6px;
        background: linear-gradient(to bottom, #1e2328 0%, #0a0e13 100%);
        border: 1px solid #463714;
        border-radius: 2px;
        cursor: pointer;
        user-select: none;
        vertical-align: middle;
        transition: border-color 120ms ease, background 120ms ease;
      }
      #${WRAP_ID}:hover {
        border-color: #785a28;
        background: linear-gradient(to bottom, #2a2f35 0%, #14191f 100%);
      }
      #${WRAP_ID}.on {
        border-color: #c8aa6e;
        background: linear-gradient(to bottom, #1e2328 0%, #0a0e13 100%);
        box-shadow: 0 0 6px rgba(200, 170, 110, 0.35) inset;
      }
      #${WRAP_ID} .sf-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #5b5a56;
        flex-shrink: 0;
        transition: background-color 120ms ease, box-shadow 120ms ease;
      }
      #${WRAP_ID}.on .sf-dot {
        background: #1eff8a;
        box-shadow: 0 0 6px rgba(30, 255, 138, 0.7);
      }
      #${WRAP_ID} .sf-label {
        font-family: "Beaufort for LOL", "LoL Display", serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #a09b8c;
        line-height: 1;
      }
      #${WRAP_ID}.on .sf-label {
        color: #f0e6d2;
      }
    `
    document.head.appendChild(style)
  }

  function buildToggle() {
    const wrap = document.createElement('div')
    wrap.id = WRAP_ID
    wrap.title = 'Auto-accept ready check'
    if (enabled) wrap.classList.add('on')

    const dot = document.createElement('span')
    dot.className = 'sf-dot'

    const label = document.createElement('span')
    label.className = 'sf-label'
    label.textContent = 'Auto Accept'

    wrap.appendChild(dot)
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

  function findHeaderRow(lobby) {
    return lobby.querySelector('.lobby-header-buttons-container')
  }

  function tryInject() {
    if (document.getElementById(WRAP_ID)) return true
    const lobby = findLobbyRoot()
    if (!lobby) return false
    const row = findHeaderRow(lobby)
    if (!row) return false
    ensureStyles()
    // Insert as the first child so the auto-accept toggle reads left-to-right
    // before the existing icons (bar chart, open party).
    row.insertBefore(buildToggle(), row.firstChild)
    console.log(LOG, 'toggle injected into .lobby-header-buttons-container')
    return true
  }

  function startLobbyObserver() {
    if (lobbyObserver) return
    lobbyObserver = new MutationObserver(() => {
      if (findLobbyRoot()) tryInject()
    })
    lobbyObserver.observe(document.body, { childList: true, subtree: true })
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    enabled = await loadSetting()
    console.log(LOG, `init — auto-accept ${enabled ? 'ON' : 'OFF'}`)

    startPoll()
    startLobbyObserver()
    setInterval(tryInject, 3000)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
