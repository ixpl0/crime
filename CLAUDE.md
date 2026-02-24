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
  main.mjs          — Electron main process, IPC handlers, PTY management
  preload.cjs       — Context bridge (contextIsolation: true)
src/
  components/       — Vue components (ToolbarPanel, ToolbarConfigEditor)
  composables/      — Reusable logic (use-toolbar-shortcuts)
  toolbar/          — Toolbar module (storage, shortcuts, default config)
  types/            — TypeScript interfaces
  App.vue           — Main component (terminal, toolbar, project picker)
  env.d.ts          — Global type declarations (window.projectApi)
  main.ts           — Vue app entrypoint
  style.css         — Tailwind + daisyUI imports
```

## Architecture

- **IPC pattern**: Renderer → `ipcRenderer.invoke()` → Main process → `ipcMain.handle()`
- **Channels**: `project:open-folder`, `settings:read/write`, `terminal:start/input/resize/run-command`
- **Toolbar config**: per-project in `.ide/toolbar.json`
- **Terminal history**: per-project in `.ide/terminal-input-history.json`

## Scripts

- `bun run dev` — Vite dev server + Electron (concurrent)
- `bun run build` — Vite production build → `dist/`
- `bun run start` — production Electron
- `bun run lint` / `lint:fix` — ESLint
- `bun run typecheck` — vue-tsc type checking

## Git

- Do not ask for approval before `git commit`, `git push`, or other git write commands. Just do it.
- In this environment, always run `git commit`, `git push`, and `git hook run pre-commit` with escalation (outside sandbox), because Git for Windows/MSYS can fail with `couldn't create signal pipe, Win32 error 5` inside sandbox.
