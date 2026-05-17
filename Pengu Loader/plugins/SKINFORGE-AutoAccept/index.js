(function initAutoAccept() {
  'use strict'

  const LOG = '[SF-AutoAccept]'
  const STORE_KEY = 'skinforge-auto-accept'
  const POLL_MS = 1000
  const ACCEPT_DELAY_MS = 2000
  const WRAP_ID = 'sf-auto-accept-wrap'

  // ── State ──────────────────────────────────────────────────────────────────
  let enabled = false
  let currentPhase = null
  let pollInterval = null
  let acceptTimeout = null

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
      const text = await res.text()
      return text.replace(/"/g, '').trim()
    } catch (_) {
      return null
    }
  }

  // ── Auto-accept (mirrors Bocchi's GameflowMonitor.handleReadyCheck) ────────
  function startPoll() {
    if (pollInterval) return
    pollInterval = setInterval(tick, POLL_MS)
  }

  async function tick() {
    const phase = await getGameflowPhase()
    if (phase !== currentPhase) {
      currentPhase = phase
      updateOverlayVisibility()
    }

    if (!enabled) return
    if (phase !== 'ReadyCheck') return
    if (acceptTimeout) return  // already scheduled

    acceptTimeout = setTimeout(async () => {
      acceptTimeout = null

      if (!enabled) return

      // Re-verify phase before accepting (matches Bocchi exactly)
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

  // ── Overlay (visible only during Lobby phase) ──────────────────────────────
  function ensureStyles() {
    if (document.getElementById('sf-aa-styles')) return
    const style = document.createElement('style')
    style.id = 'sf-aa-styles'
    style.textContent = `
      #${WRAP_ID} {
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 16px;
        background: rgba(1, 10, 19, 0.92);
        border: 1px solid #785a28;
        border-radius: 3px;
        cursor: pointer;
        user-select: none;
        z-index: 2147483646;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
        transition: opacity 120ms ease, transform 120ms ease;
      }
      #${WRAP_ID}:hover {
        background: rgba(40, 30, 12, 0.95);
      }
      #${WRAP_ID} .sf-box {
        width: 16px;
        height: 16px;
        border: 1px solid #c8aa6e;
        background: #010a13;
        position: relative;
        flex-shrink: 0;
      }
      #${WRAP_ID}.on .sf-box::after {
        content: '';
        position: absolute;
        inset: 2px;
        background: #c8aa6e;
      }
      #${WRAP_ID} .sf-label {
        font-family: "Beaufort for LOL", "LoL Display", serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #cdbe91;
      }
      #${WRAP_ID}.on .sf-label {
        color: #f0e6d2;
      }
    `
    document.head.appendChild(style)
  }

  function buildOverlay() {
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

    wrap.addEventListener('click', () => {
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

  function updateOverlayVisibility() {
    const existing = document.getElementById(WRAP_ID)
    const shouldShow = currentPhase === 'Lobby'

    if (shouldShow && !existing) {
      ensureStyles()
      document.body.appendChild(buildOverlay())
      console.log(LOG, 'overlay shown (phase=Lobby)')
    } else if (!shouldShow && existing) {
      existing.remove()
      console.log(LOG, 'overlay hidden (phase=' + currentPhase + ')')
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    enabled = await loadSetting()
    console.log(LOG, `init — auto-accept ${enabled ? 'ON' : 'OFF'}`)
    startPoll()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
