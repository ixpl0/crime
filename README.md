# Crime

General-purpose desktop IDE for projects in any language. Built with Electron + Vue 3, features integrated terminal, configurable toolbars and agent panel.

## Features

- **Integrated terminal** with multiple sessions, scenarios, input history and bell reminders
- **Configurable toolbars** — agent and terminal toolbars with JSON configs per project
- **Todo panel** with drafts
- **Prompt suffix presets** for agent workflows
- **Per-project settings** stored in `.crime/` directory
- **Secrets management** via `.crime/.env`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 40, Vue 3.5 (Composition API) |
| Language | TypeScript 5.9, strict mode |
| Styling | Tailwind CSS 4.2 + daisyUI 5.5 |
| Icons | Lucide Vue Next |
| Terminal | xterm.js + node-pty |
| Build | Vite 7.3, Bun |
| Linting | ESLint 10 (flat config) + TypeScript ESLint |
| Testing | Vitest 4 (happy-dom / node) |
| Pre-commit | Husky (lint + typecheck) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Node.js](https://nodejs.org/) (required by Electron)
- Git

### Install

```bash
bun install
```

### Development

```bash
bun run dev
```

Starts Vite dev server on `http://localhost:5173` and launches Electron pointing to it. Electron auto-restarts on changes in `electron/`.

### Production

```bash
bun run build
bun run start
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Vite dev server + Electron (concurrent) |
| `bun run build` | Vite production build |
| `bun run start` | Run production Electron |
| `bun run lint` | ESLint check |
| `bun run lint:fix` | ESLint auto-fix |
| `bun run typecheck` | vue-tsc type checking |
| `bun run test` | Run all tests |
| `bun run test:watch` | Tests in watch mode |
| `bun run test:coverage` | Tests with V8 coverage |
| `bun run dist` | Build + package for Windows (NSIS) |
| `bun run dist:mac` | Build + package for macOS |
| `bun run dist:linux` | Build + package for Linux (AppImage) |

## Project Structure

```
electron/                — Electron main process
  main.mjs               — Entry point, window creation, IPC registration
  preload.cjs            — Context bridge (auto-generated shared constants)
  ipc-channels.cjs       — IPC channel name constants
  main/                  — Main process modules
    ipc/                 — IPC handlers (filesystem, terminal, settings, shell, etc.)

src/                     — Vue renderer process
  app/                   — App shell, store initialization
  components/            — Vue components (toolbars, dialogs, config editors, etc.)
  composables/           — Shared composables and stores
  config/                — Config management
  defaults/              — Default JSON configs for toolbars
  layout/                — Layout management
  navigation/            — Navigation stores
  session/               — Session and recent projects
  settings/              — Settings storage
  terminal/              — Terminal module
  todo/                  — Todo module
  toolbar/               — Toolbar storage, shortcuts, styles
  types/                 — TypeScript interfaces
  utils/                 — Helpers

scripts/                 — Build utilities
  sync-preload-shared.mjs — Sync IPC constants into preload.cjs
  after-pack.mjs         — Electron Builder post-pack hook (sets app icon)
```

## Per-Project Config

Each project stores its configuration in a `.crime/` directory:

| File | Purpose |
|------|---------|
| `settings.json` | Zoom, terminal, slash-command settings |
| `agent-toolbar.json` | Agent toolbar actions and dropdowns |
| `terminal-toolbar.json` | Terminal workspace toolbar |
| `prompt-suffixes.json` | Prompt suffix presets |
| `todo.json` | Todo list |
| `.env` | Secrets (API keys, etc.) |

## Architecture

- **IPC**: Renderer communicates with main process via `ipcRenderer.invoke()` / `ipcMain.handle()`
- **State management**: Vue 3 inject/provide stores
- **Preload**: Sandboxed, self-contained — no local `require()` imports allowed
- **IPC channels**: Defined in `electron/ipc-channels.cjs`, auto-synced to preload via `scripts/sync-preload-shared.mjs`
