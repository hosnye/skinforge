/**
 * @name SKINFORGE-SettingsPanel
 * @author Skinforge
 * @description Foundation panel for Skinforge client-customization features.
 *
 * This is the first plugin in the SKINFORGE-* namespace. It runs in the
 * League Client (via Pengu Loader) and acts as the entry point for all our
 * future custom-feature UI. Right now it just mounts a small badge in the
 * top-right and logs activity to the dev console (Ctrl+Shift+I in League).
 *
 * IMPORTANT: this plugin coexists with the upstream ROSE-* plugins. It does
 * NOT touch Rose's skin pipeline. Our features live under their own panel.
 */
(function initSkinforgePanel() {
  'use strict'

  const LOG_PREFIX = '[Skinforge]'
  const BADGE_ID = 'skinforge-badge'
  const PANEL_ID = 'skinforge-panel'
  const STYLE_ID = 'skinforge-styles'

  // Design tokens — match League's gold theme so the badge looks native.
  const T = {
    surface: '#010a13',
    gold1: '#c8aa6e',
    gold4: '#785a28',
    text: '#cdbe91',
    fontUi: '"Beaufort for LOL","LoL Display",serif',
  }

  // ── Logging ─────────────────────────────────────────────────────────────
  function log(...args) {
    console.log(LOG_PREFIX, ...args)
  }
  function warn(...args) {
    console.warn(LOG_PREFIX, ...args)
  }

  // ── Style injection ─────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${BADGE_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        padding: 6px 14px;
        background: ${T.surface};
        color: ${T.gold1};
        border: 1px solid ${T.gold4};
        border-radius: 3px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-family: ${T.fontUi};
        z-index: 2147483647;
        cursor: pointer;
        user-select: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      }
      #${BADGE_ID}:hover {
        background: rgba(120, 90, 40, 0.15);
      }
      #${PANEL_ID} {
        position: fixed;
        top: 56px;
        right: 16px;
        width: 320px;
        background: ${T.surface};
        color: ${T.text};
        border: 1px solid ${T.gold4};
        border-radius: 4px;
        padding: 16px;
        font-family: ${T.fontUi};
        font-size: 12px;
        z-index: 2147483646;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
        display: none;
      }
      #${PANEL_ID}.open {
        display: block;
      }
      #${PANEL_ID} h2 {
        margin: 0 0 12px;
        color: ${T.gold1};
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      #${PANEL_ID} p {
        margin: 0 0 8px;
        line-height: 1.5;
      }
    `
    document.head.appendChild(style)
  }

  // ── Badge + panel ───────────────────────────────────────────────────────
  function mountBadge() {
    if (!document.body) {
      // Body not ready yet — try again on next animation frame.
      requestAnimationFrame(mountBadge)
      return
    }
    if (document.getElementById(BADGE_ID)) return

    const badge = document.createElement('div')
    badge.id = BADGE_ID
    badge.textContent = 'SKINFORGE'
    badge.title = 'Skinforge — click to open settings'
    badge.addEventListener('click', togglePanel)
    document.body.appendChild(badge)

    const panel = document.createElement('div')
    panel.id = PANEL_ID
    panel.innerHTML = `
      <h2>Skinforge</h2>
      <p>Client customization plugin foundation.</p>
      <p style="opacity:0.7;font-size:11px;">Built on top of Rose's Pengu Loader integration. Skin pipeline is handled by the upstream Rose codebase; Skinforge adds new client-side features as additional plugins.</p>
      <p style="opacity:0.5;font-size:10px;margin-top:12px;">Plugin v0.0.1 — feature stubs to follow</p>
    `
    document.body.appendChild(panel)

    log('badge + panel mounted')
  }

  function togglePanel() {
    const panel = document.getElementById(PANEL_ID)
    if (!panel) return
    panel.classList.toggle('open')
    log('panel toggled', panel.classList.contains('open') ? 'open' : 'closed')
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    log(`plugin v0.0.1 init at ${new Date().toISOString()}`)
    injectStyles()
    mountBadge()

    // Reserved hook for future IPC with Rose's Python backend. Rose's plugins
    // get a `window.__roseBridge` object once the WS handshake completes.
    // We don't need it yet for the badge-only foundation, but here's the
    // pattern when we do:
    //
    //   waitForBridge().then(bridge => {
    //     bridge.on('SOME_EVENT', handler)
    //     bridge.send('CUSTOM_FEATURE_REQUEST', payload)
    //   })
    if (window.__roseBridge) {
      log('Rose bridge already present')
    } else {
      log('Rose bridge not yet present (will arrive after Skinforge connects)')
    }
  }

  // Pengu plugins run after document is parsed but DOM may still be empty.
  // Defer until next frame so document.body exists.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
