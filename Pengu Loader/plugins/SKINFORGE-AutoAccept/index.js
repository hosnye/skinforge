(function initAutoAccept() {
  'use strict'

  const LOG = '[SF-AutoAccept]'
  const STORE_KEY = 'skinforge-auto-accept'
  const POLL_MS = 1000
  const ACCEPT_DELAY_MS = 2000

  // ── State ──────────────────────────────────────────────────────────────────
  let enabled = false
  let pollInterval = null
  let acceptTimeout = null
  let injectObserver = null

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

  // ── LCU gameflow phase helper ──────────────────────────────────────────────
  async function getGameflowPhase() {
    try {
      const res = await fetch('/lol-gameflow/v1/gameflow-phase')
      if (!res.ok) return null
      const text = await res.text()
      // Response is a JSON string e.g. "\"ReadyCheck\""
      return text.replace(/"/g, '').trim()
    } catch (_) {
      return null
    }
  }

  // ── Detection & accept (mirrors Bocchi's GameflowMonitor.handleReadyCheck) ─
  function startPoll() {
    if (pollInterval) return
    pollInterval = setInterval(checkPhase, POLL_MS)
  }

  function stopPoll() {
    if (!pollInterval) return
    clearInterval(pollInterval)
    pollInterval = null
  }

  async function checkPhase() {
    if (!enabled) return
    const phase = await getGameflowPhase()
    if (phase !== 'ReadyCheck') return

    // Phase is ReadyCheck — stop polling to prevent double-trigger
    stopPoll()

    // Clear any existing countdown
    if (acceptTimeout) { clearTimeout(acceptTimeout); acceptTimeout = null }

    acceptTimeout = setTimeout(async () => {
      acceptTimeout = null

      if (!enabled) {
        // User disabled during countdown — skip accept
        startPoll()
        return
      }

      // Re-verify phase before accepting (matches Bocchi exactly)
      const currentPhase = await getGameflowPhase()
      if (currentPhase !== 'ReadyCheck') {
        console.log(LOG, 'phase changed during delay — skipping accept')
        startPoll()
        return
      }

      try {
        await fetch('/lol-matchmaking/v1/ready-check/accept', { method: 'POST' })
        console.log(LOG, 'accepted')
      } catch (e) {
        console.warn(LOG, 'accept failed', e)
      }

      // Resume polling for the next queue
      startPoll()
    }, ACCEPT_DELAY_MS)
  }

  // ── Checkbox UI injection ──────────────────────────────────────────────────
  function buildCheckbox() {
    const wrap = document.createElement('div')
    wrap.id = 'sf-auto-accept-wrap'
    wrap.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:6px 12px 6px 8px',
      'cursor:pointer',
      'user-select:none',
    ].join(';')

    const cb = document.createElement('lol-uikit-flat-checkbox')
    if (enabled) cb.setAttribute('class', 'checked')

    const input = document.createElement('input')
    input.slot = 'input'
    input.type = 'checkbox'
    input.checked = enabled
    cb.appendChild(input)

    const label = document.createElement('span')
    label.textContent = 'Auto Accept'
    label.style.cssText = [
      'font-family:"Beaufort for LOL","LoL Display",serif',
      'font-size:11px',
      'font-weight:700',
      'letter-spacing:0.08em',
      'text-transform:uppercase',
      'color:#cdbe91',
    ].join(';')

    wrap.appendChild(cb)
    wrap.appendChild(label)

    wrap.addEventListener('click', () => {
      enabled = !enabled
      input.checked = enabled
      if (enabled) {
        cb.setAttribute('class', 'checked')
        startPoll()
      } else {
        cb.removeAttribute('class')
        if (acceptTimeout) { clearTimeout(acceptTimeout); acceptTimeout = null }
        stopPoll()
      }
      saveSetting(enabled)
      console.log(LOG, 'toggled →', enabled)
    })

    return wrap
  }

  function findAnchor() {
    const social = document.querySelector('lol-social-lower-pane-component')
    if (social) return { parent: social.parentElement, before: social }

    const stats = document.querySelector('.lobby-stats-profile')
    if (stats) return { parent: stats.parentElement, before: stats }

    const cta = document.querySelector('lol-lobby-team-builder-cta-component')
    if (cta) return { parent: cta, before: cta.firstElementChild }

    return null
  }

  function tryInject() {
    if (document.getElementById('sf-auto-accept-wrap')) return true
    const anchor = findAnchor()
    if (!anchor || !anchor.parent) return false
    anchor.parent.insertBefore(buildCheckbox(), anchor.before)
    console.log(LOG, 'checkbox injected')
    return true
  }

  // ── MutationObserver ───────────────────────────────────────────────────────
  function startObserver() {
    if (injectObserver) return
    injectObserver = new MutationObserver(() => {
      const inLobby = !!(
        document.querySelector('lol-social-lower-pane-component') ||
        document.querySelector('.lobby-stats-profile') ||
        document.querySelector('lol-lobby-team-builder-cta-component')
      )
      if (inLobby) {
        tryInject()
      } else {
        const stale = document.getElementById('sf-auto-accept-wrap')
        if (stale) stale.remove()
      }
    })
    injectObserver.observe(document.body, { childList: true, subtree: true })
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    enabled = await loadSetting()
    console.log(LOG, `init — auto-accept ${enabled ? 'ON' : 'OFF'}`)

    startObserver()
    setInterval(tryInject, 5000)

    if (enabled) startPoll()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
