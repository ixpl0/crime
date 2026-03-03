# Dream IDE

Electron + Vue 3 desktop IDE with integrated terminal and configurable toolbar.

## Tech Stack

- **Runtime**: Electron 40, Vue 3.5 (Composition API, `<script setup lang="ts">`)
- **Language**: TypeScript 5.9, strict mode
- **Styling**: Tailwind CSS 4.2 + daisyUI 5.5
- **Icons**: Lucide Vue Next
- **Terminal**: xterm.js + node-pty (PTY)
- **Code Viewer**: CodeMirror 6 (diff decorations, language detection)
- **Build**: Vite 7.3, Bun (package manager)
- **Linting**: ESLint 10 (flat config) + TypeScript ESLint
- **Pre-commit**: Husky

## Project Structure

```
electron/
  main.mjs               — Electron main process entry, window creation, IPC registration
  preload.cjs            — Context bridge (contextIsolation: true, window.projectApi)
  ipc-channels.cjs       — IPC channel name constants
  settings-constants.cjs — Settings directory name (".ide")
  quick-key-bindings.cjs — Global quick key definitions
  main/
    child-process-env.mjs  — PTY/shell environment setup
    error-utils.mjs        — Error handling, IPC error responses
    git-service.mjs        — Git operations (status, diff, log, revert)
    git-utils.mjs          — Git helper utilities
    git-parsers.mjs        — Git output parsing
    run-command.mjs        — External command execution
    window-state.mjs       — Window state persistence
    ipc/
      register-clipboard-ipc.mjs    — clipboard:write-text
      register-filesystem-ipc.mjs   — filesystem CRUD operations
      register-git-ipc.mjs          — git status, diff, revert, log, commit-details
      register-git-watcher-ipc.mjs  — git file change watcher
      register-project-ipc.mjs      — project:open-folder
      register-settings-ipc.mjs     — settings read/write/watch
      register-shell-ipc.mjs        — shell:open-external
      register-terminal-ipc.mjs     — terminal start/input/resize/stop
src/
  app/                   — App shell (use-app-shell composable, initializes all stores)
  codemirror/            — CodeMirror integration (diff-decorations, language-detection)
  components/            — Vue components
    file-manager/        — File tree panel, context menu, path/status utils
    changes/             — Git changes panel (diff viewer)
    git-graph/           — Git history graph visualization
  composables/           — Shared composables (use-git-status, use-theme, use-toolbar-shortcuts)
  config/                — Config management (config-store, use-config-management)
  defaults/              — Default JSON configs (agent-toolbar, prompt-suffixes, terminal-toolbar)
  layout/                — Layout management (use-project-layout, zoom/font normalization)
  navigation/            — Navigation (navigation-store, use-app-navigation, use-file-navigation)
  prompt-suffix/         — Prompt suffix module (storage)
  session/               — Session management (use-app-runtime, use-project-session, use-recent-projects)
  settings/              — Settings storage (project-settings, terminal-history, todo, secrets)
  terminal/              — Terminal module (store, actions, view, submit, input history, keyboard)
  todo/                  — Todo module (store, use-todo-panel, drafts utils)
  toolbar/               — Toolbar module (storage, shortcuts, button styles, tracking)
  types/                 — TypeScript interfaces (toolbar, project-settings, prompt-suffix, utils)
  utils/                 — Helpers (fail-fast, array-utils, dropdown-utils)
  App.vue                — Main component (project picker, layout orchestration)
  env.d.ts               — Global type declarations (ProjectApi interface, window.projectApi)
  main.ts                — Vue app entrypoint
  style.css              — Tailwind + daisyUI imports
```

## Architecture

- **IPC pattern**: Renderer → `ipcRenderer.invoke()` → Main process → `ipcMain.handle()`
- **State management**: Vue 3 inject/provide stores (AppTerminalStore, AppTodoStore, AppConfigStore, AppNavigationStore)
- **Channels**: defined in `electron/ipc-channels.cjs`, auto-synced to preload via `scripts/sync-preload-shared.mjs`
  - `project:open-folder`
  - `settings:read/write/watch/unwatch`, `settings:file-changed`
  - `terminal:start/input/resize/stop`, `terminal:data/exit`
  - `clipboard:write-text`
  - `filesystem:read-directory/read-file/delete-path/write-file`
  - `git:status/file-diff/revert-file/revert-all/log/commit-details`
  - `git:changed/watch/unwatch`
  - `shell:open-external`
  - `global:quick-key`
- **Per-project config** (in `.ide/` directory):
  - `agent-toolbar.json` — toolbar actions and dropdowns
  - `settings.json` — zoom, terminal, slash-command settings
  - `prompt-suffixes.json` — prompt suffix presets
  - `terminal-toolbar.json` — terminal workspace toolbar
  - `terminal-input-history.json` — terminal input history
  - `todo.json` — todo list
  - `.env` — secrets (API keys, etc.)

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
- `bun run sync:preload-shared` — Sync IPC channels into preload.cjs (auto-runs before dev/build/start)

## Git

- Do not ask for approval before `git commit`, `git push`, or other git write commands. Just do it.
- In this environment, always run `git commit` and `git push` with escalation (outside sandbox), because Git for Windows/MSYS can fail with `couldn't create signal pipe, Win32 error 5` inside sandbox.
