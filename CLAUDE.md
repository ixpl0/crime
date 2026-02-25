# Dream IDE

Electron + Vue 3 desktop IDE with integrated terminal and configurable toolbar.

## Tech Stack

- **Runtime**: Electron 40, Vue 3.5 (Composition API, `<script setup lang="ts">`)
- **Language**: TypeScript 5.9, strict mode
- **Styling**: Tailwind CSS 4.2 + daisyUI 5.5
- **Icons**: Lucide Vue Next
- **Terminal**: xterm.js + node-pty (PTY)
- **Build**: Vite 7.3, Bun (package manager)
- **Linting**: ESLint 10 (flat config) + TypeScript ESLint
- **Pre-commit**: Husky

## Project Structure

```
electron/
  main.mjs               — Electron main process, IPC handlers, PTY, git, filesystem
  preload.cjs            — Context bridge (contextIsolation: true)
  ipc-channels.cjs       — IPC channel name constants
  settings-constants.cjs — Settings directory name (".ide")
  quick-key-bindings.cjs — Global quick key definitions
src/
  components/            — Vue components (Toolbar, PromptSuffix, FileManager, Settings editors)
  composables/           — Reusable logic (use-toolbar-shortcuts)
  toolbar/               — Toolbar module (storage, shortcuts, default config)
  prompt-suffix/         — Prompt suffix module (storage, defaults)
  settings/              — Project settings, terminal history, todo storage
  types/                 — TypeScript interfaces (toolbar, project-settings, prompt-suffix)
  utils/                 — Helpers (fail-fast error handling)
  App.vue                — Main component (terminal, toolbar, project picker, file manager)
  env.d.ts               — Global type declarations (window.projectApi)
  main.ts                — Vue app entrypoint
  style.css              — Tailwind + daisyUI imports
```

## Architecture

- **IPC pattern**: Renderer → `ipcRenderer.invoke()` → Main process → `ipcMain.handle()`
- **Channels**: defined in `electron/ipc-channels.cjs`, exposed via `electron/preload.cjs`
  - `project:open-folder`
  - `settings:read/write/watch/unwatch`, `settings:file-changed`
  - `terminal:start/input/resize/stop`, `terminal:data/exit`
  - `clipboard:write-text`
  - `filesystem:read-directory/read-file`
  - `git:status/file-diff`
  - `global:quick-key`
- **Per-project config** (in `.ide/` directory):
  - `agent-toolbar.json` — toolbar actions and dropdowns
  - `settings.json` — zoom, terminal, slash-command settings
  - `prompt-suffixes.json` — prompt suffix presets
  - `terminal-input-history.json` — terminal input history
  - `todo.json` — todo list

## Engineering Principles

- **Terminal freedom first**: do not sanitize, rewrite, or filter PTY byte streams. Terminal behavior must remain fully controlled by shell and user actions.
- **Fail-fast in development**: surface errors immediately in UI/logs instead of silently swallowing them.

## Preload Caveat

- `electron/preload.cjs` runs in a sandboxed preload context.
- Keep preload self-contained and avoid local `require("./...")` imports there.
- If local imports are used, Electron may fail with `module not found`, and `window.projectApi` can be undefined in renderer.

## Scripts

- `bun run dev` — Vite dev server + Electron (concurrent)
- `bun run build` — Vite production build → `dist/`
- `bun run start` — production Electron
- `bun run lint` / `lint:fix` — ESLint
- `bun run typecheck` — vue-tsc type checking

## Git

- Do not ask for approval before `git commit`, `git push`, or other git write commands. Just do it.
- In this environment, always run `git commit` and `git push` with escalation (outside sandbox), because Git for Windows/MSYS can fail with `couldn't create signal pipe, Win32 error 5` inside sandbox.
