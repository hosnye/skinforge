# Skill Forge - Effortless Skin Changer for LoL

<div align="center">

  <img src="./assets/icon.png" alt="Skill Forge Icon" width="128" height="128">

[![Installer](https://img.shields.io/badge/Installer-Windows-32A832)](https://github.com/hosnye/skinforge/releases/latest) [![Ko-Fi](https://img.shields.io/badge/KoFi-Donate-C03030?logo=ko-fi&logoColor=white)](https://ko-fi.com/skinforge) [![License](https://img.shields.io/badge/License-MIT-C03030)](LICENSE) [![Downloads](https://img.shields.io/github/downloads/hosnye/skinforge/total?color=32A832&label=Downloads)](https://github.com/hosnye/skinforge/releases/latest)

</div>

---

## Overview

Skill Forge is an open-source automatic skin changer for League of Legends that gives seamless access to every skin in the game. The application runs silently in the system tray, detects skin selections during champion select, and injects the chosen skin when the game loads.

Built on the [Pengu Loader](https://github.com/PenguLoader/PenguLoader) framework, Skill Forge layers JavaScript plugins into the League Client to enable modular UI interactions. It strictly modifies local rendering variables to display custom models and textures - it does **not** manipulate network data, memory states, or gameplay mechanics, so it **offers zero competitive advantage**.

## What makes Skill Forge different

- **In-lobby auto-accept** - a native-looking toggle in the lobby header pops your ready-checks automatically (2-second delay, phase re-verification, Bocchi-style behavior)
- **Standalone branding & data dir** - own executable, own `%LOCALAPPDATA%` directory, separate Windows AppId - installs cleanly alongside other skin-changer tools
- **Auto-update from this repo** - the app shell updates from `hosnye/skinforge` releases, while upstream skin data keeps flowing in

## Architecture

### Python Backend

- **LCU API Integration**: communicates with the League Client via the LCU API
- **Skin Injection**: handles skin injection compatible with Riot Vanguard
- **WebSocket Bridge**: real-time bridge between the Python tray app and the in-client Pengu plugins
- **Skin Management**: downloads and manages encrypted skin files from upstream - files are decrypted at runtime and wiped after use
- **Party Mode**: skin sharing between friends in the same lobby via a Cloudflare WebSocket relay
- **Game Monitoring**: tracks game state, champion select phases, and loadout countdowns
- **Auto-Updater**: polls this repo's GitHub releases and prompts users to install updates

### Pengu Loader Plugins

| Plugin | Purpose |
|---|---|
| **SKINFORGE-AutoAccept** | In-lobby toggle that auto-accepts ready-checks |
| **ROSE-UI** | Unlocks locked skin previews in champion select |
| **ROSE-SkinMonitor** | Monitors selected skin and sends it to the Python backend |
| **ROSE-CustomWheel** | Custom mod metadata for hovered skins |
| **ROSE-ChromaWheel** | Enhanced chroma selection |
| **ROSE-FormsWheel** | Form selection for skins like Elementalist Lux, Sahn Uzal Mordekaiser, Spirit Blossom Morgana, Radiant Sett |
| **ROSE-SettingsPanel** | Settings panel inside the League client |
| **ROSE-RandomSkin** | Random skin selection |
| **ROSE-HistoricMode** | Quick access to the last-used skin for every champion |
| **ROSE-PartyMode** | Real-time skin sharing UI for parties |
| **ROSE-Jade** | Client customization - regalia borders, banners, icons, win/loss stats |

## How It Works

1. **Activation**: Skill Forge starts Pengu Loader on launch, which injects the JS plugins into the League Client
2. **Skin Detection**: when you hover a skin in champion select, `ROSE-SkinMonitor` reports it to the Python backend
3. **Game Open Delay**: League's game process is briefly suspended to give injection time to complete
4. **Injection**: Skill Forge decrypts and injects the selected skin when the game starts
5. **Seamless Experience**: the skin loads as if owned - chromas supported, no gameplay impact

## Features

- **Smart Injection** - never injects skins you already own
- **In-lobby Auto-Accept** - never miss a ready-check
- **Multi-Language Support** - works with any client language
- **Open Source** - fully open and extensible
- **Free** - if you paid for this software, you got scammed 💀

## Requirements

- **Windows 10/11**
- **League of Legends** installed
- **Injection DLL** - you must provide your own signed DLL (see below)

### DLL Requirement

Due to DMCA restrictions, Skill Forge cannot distribute the injection DLL file. You must obtain this file yourself from an authorized source and sign it with your own code-signing certificate.

On first launch, Skill Forge will prompt you to provide this file and open the folder where it should be placed.

## Installation

1. Download the latest installer from [Releases](https://github.com/hosnye/skinforge/releases/latest)
2. Run the installer as Administrator
3. Launch Skill Forge from the Start Menu or desktop shortcut

The installer registers Skill Forge under its own Windows AppId and user-data directory - it does not touch any other skin-changer installation you may already have.

## Auto-Update

Skill Forge polls this repository's latest GitHub release on startup. When a newer `vX.Y.Z` tag is published with a `.zip` asset, the app downloads and replaces itself before the next launch. Skin data updates happen on a separate channel and continue to flow in independently.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and project structure.

## Legal Disclaimer

This project is not endorsed by or affiliated with Riot Games. Riot Games and all related properties are trademarks or registered trademarks of Riot Games, Inc.

Custom skins are allowed under Riot's terms of service and are not detected. Do not discuss or advertise skin tools in-game. Users proceed at their own risk.

## Support

If you enjoy Skill Forge and want to support development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/skinforge)

## Credits

Built on the shoulders of:

- **[Alban1911/Rose](https://github.com/Alban1911/Rose)** - base application, skin pipeline, and installer scaffolding
- **[hoangvu12/Bocchi](https://github.com/hoangvu12/bocchi)** - auto-accept behavior reference (2s delay + phase re-verification)
- **[PenguLoader](https://github.com/PenguLoader/PenguLoader)** - League client plugin host

---

**Skill Forge** - _League, unlocked._
