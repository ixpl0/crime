# Crime

General-purpose desktop IDE for projects in any language. Built with Electron + Vue 3, features integrated terminal, configurable toolbars, git integration and agent panel.

## Tech Stack

- **Runtime**: Electron 40, Vue 3.5 (Composition API, `<script setup lang="ts">`)
- **Language**: TypeScript 5.9, strict mode
- **Styling**: Tailwind CSS 4.2 + daisyUI 5.5
- **Icons**: Lucide Vue Next
- **Terminal**: xterm.js + node-pty (PTY)
- **Code Viewer**: CodeMirror 6 (diff decorations, language detection)
- **Build**: Vite 7.3, Bun (package manager)
- **Linting**: ESLint 10 (flat config) + TypeScript ESLint
- **Testing**: Vitest 4 (happy-dom for Vue, node for Electron)
- **Pre-commit**: Husky

## Project Structure

```
electron/
  main.mjs               — Electron main process entry, window creation, IPC registration
  preload.cjs            — Context bridge (contextIsolation: true, window.projectApi)
  ipc-channels.cjs       — IPC channel name constants
  settings-constants.cjs — Settings directory name (".crime")
  quick-key-bindings.cjs — Global quick key definitions (Ctrl+Alt+Shift combos)
  main/
    child-process-env.mjs  — PTY/shell environment setup
    error-utils.mjs        — Error handling, IPC error responses
    git-service.mjs        — Git operations (status, diff, log, revert, checkout, branches, merge)
    git-utils.mjs          — Git helper utilities
    git-parsers.mjs        — Git output parsing
    logger.mjs             — Main process logging
    run-command.mjs        — External command execution
    window-state.mjs       — Window state persistence (size, position, maximized)
    win32-window-placement.mjs — Windows-specific window placement
    ipc/
      path-utils.mjs                  — Path resolution utilities
      register-clipboard-ipc.mjs      — clipboard:write-text
      register-filesystem-ipc.mjs     — filesystem CRUD (read/write/delete/move/copy/create/search)
      register-git-ipc.mjs            — git status, diff, revert, log, commit-details, branches, merge
      register-git-watcher-ipc.mjs    — git file change watcher (chokidar)
      register-project-ipc.mjs        — project:open-folder, create-folder, open-in-new-window
      register-search-ipc.mjs         — filesystem:search, filesystem:search-content
      register-settings-ipc.mjs       — settings read/write/watch
      register-shell-ipc.mjs          — shell:open-external, shell:open-path
      register-terminal-ipc.mjs       — terminal start/input/resize/stop (node-pty)
src/
  app/                   — App shell (use-app-shell composable, initializes all stores)
  codemirror/            — CodeMirror integration (diff-decorations, conflict-decorations, language-detection, search-match-counter)
  components/            — Vue components
    file-manager/        — File tree panel, context menu, drag-drop, path/status utils
    changes/             — Git changes panel (diff viewer)
    git-graph/           — Git history graph visualization, commit details
    visual-config/       — Form field components (text, number, checkbox, color, select)
  composables/           — Shared composables and stores (git-status, theme, toolbar-shortcuts, resize, diff-navigation, status-bar-store, agent-focus-redirect)
  config/                — Config management (config-store, use-config-management)
  defaults/              — Default JSON configs (agent-toolbar, git-toolbar, prompt-suffixes, terminal-toolbar)
  layout/                — Layout management (use-project-layout, zoom/font normalization)
  navigation/            — Navigation (navigation-store, use-app-navigation, use-file-navigation)
  prompt-suffix/         — Prompt suffix module (storage)
  search/                — File search dialog (SearchDialog, search-dialog-store, use-file-search)
  session/               — Session management (use-app-runtime, use-project-session, use-recent-projects)
  settings/              — Settings storage (project-settings, terminal-history, todo, secrets)
  terminal/              — Terminal module (store, actions, view, submit, input history, keyboard, scenarios, bell)
  tips/                  — Tips rotation (tips-data, use-tips-rotation)
  toast/                 — Toast notification system (toast-store)
  todo/                  — Todo module (store, use-todo-panel, drafts utils)
  toolbar/               — Toolbar module (storage for agent/git/terminal toolbars, shortcuts, button styles, tracking)
  types/                 — TypeScript interfaces (toolbar, project-settings, prompt-suffix, utils)
  utils/                 — Helpers (fail-fast, array-utils, dropdown-utils, context-menu-utils, dialog-utils, path-utils)
  App.vue                — Main component (project picker, layout orchestration, focus management)
  env.d.ts               — Global type declarations (ProjectApi interface, window.projectApi)
  main.ts                — Vue app entrypoint
  style.css              — Tailwind + daisyUI imports
```

## Architecture

- **IPC pattern**: Renderer → `ipcRenderer.invoke()` → Main process → `ipcMain.handle()`
- **State management**: Vue 3 inject/provide stores (AppTerminalStore, AppTodoStore, AppConfigStore, AppNavigationStore, AppToastStore, SearchDialogStore, StatusBarStore, DebugTodoStore)
- **Channels**: defined in `electron/ipc-channels.cjs`, auto-synced to preload via `scripts/sync-preload-shared.mjs`
  - `project:open-folder/create-folder/open-in-new-window`
  - `settings:read/write/watch/unwatch`, `settings:file-changed`
  - `terminal:start/input/resize/stop`, `terminal:data/exit`
  - `clipboard:write-text`
  - `filesystem:read-directory/read-file/delete-path/write-file/move-path/copy-paths/create-path`
  - `git:status/file-diff/revert-file/revert-all/log/commit-details/commit-file-diff`
  - `git:checkout/unmerged-files/create-branch/delete-branch/delete-remote-branch`
  - `git:merge-state/resolve-file/accept-conflict-version/abort-merge`
  - `git:changed/watch/unwatch`
  - `filesystem:search/search-content`
  - `shell:open-external/open-path`
  - `window:flash-frame`
  - `global:quick-key`
  - `log:write`
- **Per-project config** (in `.crime/` directory):
  - `agent-toolbar.json` — agent toolbar actions and dropdowns
  - `git-toolbar.json` — git operations toolbar
  - `terminal-toolbar.json` — terminal workspace toolbar
  - `settings.json` — zoom, terminal, slash-command settings
  - `prompt-suffixes.json` — prompt suffix presets
  - `terminal-input-history.json` — terminal input history
  - `todo.json` — todo list
  - `.env` — secrets (API keys, etc.)

## Engineering Principles

- **Language-agnostic IDE**: Crime is used for projects in any programming language. Toolbar prompts (review, practices, etc.) must not assume a specific language or ecosystem — always detect the project's stack first.
- **Terminal freedom first**: do not sanitize, rewrite, or filter PTY byte streams. Terminal behavior must remain fully controlled by shell and user actions.
- **Fail-fast in development**: surface errors immediately in UI/logs instead of silently swallowing them.
- **Focus management**: Tab-навигация отключена для всех UI-элементов. Основной фокус — textarea терминала. Обеспечивается: (1) глобальный mousedown handler в App.vue предотвращает фокус на кнопках, (2) CSS убирает focus outline, (3) tabindex="-1" на всех кнопках. При добавлении новых кнопок — всегда ставить tabindex="-1".
- **Multiple terminal sessions**: терминал поддерживает несколько сессий (sessionId), переключаемых через workspace panel.

## Toolbar System

Три независимых тулбара, каждый со своим JSON-конфигом в `.crime/`:
- **Agent toolbar** (`agent-toolbar.json`) — основная панель с агентами, ревью, настройками
- **Git toolbar** (`git-toolbar.json`) — git-операции
- **Terminal toolbar** (`terminal-toolbar.json`) — кнопки над терминалом

Типы действий: `prompt` (текст агенту), `command` (команда в терминал), `raw-input` (сырой ввод), `scenario` (многошаговый сценарий с wait/wait-for/delay).

Цвета: daisyUI пресеты (primary, secondary, accent, info, success, warning, error, neutral, ghost), HEX (`#RRGGBB`), oklch (`oklch(0.8 0.15 200)`).

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
- `bun run test` / `test:watch` / `test:coverage` — Vitest
- `bun run dist` / `dist:mac` / `dist:linux` — Electron Builder
- `bun run sync:preload-shared` — Sync IPC channels into preload.cjs (auto-runs before dev/build/start)

## Git

- Do not ask for approval before `git commit`, `git push`, or other git write commands. Just do it.
- In this environment, always run `git commit` and `git push` with escalation (outside sandbox), because Git for Windows/MSYS can fail with `couldn't create signal pipe, Win32 error 5` inside sandbox.
