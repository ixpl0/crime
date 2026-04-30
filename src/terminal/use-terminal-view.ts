import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { type Ref } from "vue";
import { playTerminalBell } from "./play-terminal-bell";
import { collectTerminalPathMatches } from "./terminal-path-utils";

type TerminalBackendResponse = {
  ok: boolean;
  error?: string | null;
};

type TerminalSize = {
  cols: number;
  rows: number;
};

type UseTerminalViewOptions = {
  terminalContainer: Ref<HTMLElement | null>;
  projectPath: Ref<string | null>;
  isTerminalReady: Ref<boolean>;
  getTerminalFontSize: () => number;
  sendTerminalInput: (data: string, fallbackMessage: string) => Promise<boolean>;
  openTerminalPath: (
    path: string,
    line: number | null,
    column: number | null
  ) => void | Promise<void>;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => void;
  writeClipboardText: (text: string) => Promise<TerminalBackendResponse>;
  resizeTerminalBackendRequest: (size: TerminalSize) => Promise<TerminalBackendResponse>;
  startTerminalBackendRequest: (
    cwd: string,
    size: TerminalSize
  ) => Promise<TerminalBackendResponse>;
  resetTerminalSessionState: () => void;
  onBell?: () => void;
};

type TerminalViewState = {
  options: UseTerminalViewOptions;
  terminal: Terminal | null;
  fitAddon: FitAddon | null;
  webLinksAddon: WebLinksAddon | null;
  terminalPathLinkProvider: { dispose: () => void } | null;
  resizeObserver: ResizeObserver | null;
};

const DEFAULT_INPUT_ERROR = "Не удалось отправить ввод в терминал.";
const INITIAL_TERMINAL_MESSAGE = "Терминал готов. Выберите папку проекта.";
const PREPARE_TERMINAL_ERROR = "Не удалось подготовить окно терминала.";
const START_TERMINAL_ERROR = "Не удалось запустить терминал.";

function createTerminal(fontSize: number) {
  return new Terminal({
    convertEol: true,
    cursorBlink: true,
    cursorStyle: "bar",
    cursorInactiveStyle: "none",
    cursorWidth: 2,
    fontFamily: "Cascadia Mono, Consolas, monospace",
    fontSize,
    theme: {
      background: getComputedStyle(document.documentElement).getPropertyValue("--terminal-bg").trim() || "#05070d",
      foreground: "#e5e7eb",
      cursor: "#e5e7eb"
    }
  });
}

function createTerminalViewState(options: UseTerminalViewOptions): TerminalViewState {
  return {
    options,
    terminal: null,
    fitAddon: null,
    webLinksAddon: null,
    terminalPathLinkProvider: null,
    resizeObserver: null
  };
}

function createTerminalPathLinks(state: TerminalViewState, bufferLineNumber: number) {
  const currentProjectPath = state.options.projectPath.value;
  const { terminal } = state;
  if (!currentProjectPath || !terminal) {
    return undefined;
  }

  const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
  const lineText = line?.translateToString(false) ?? "";
  const pathMatches = collectTerminalPathMatches(lineText, currentProjectPath);
  if (pathMatches.length === 0) {
    return undefined;
  }

  return pathMatches.map((pathMatch) => ({
    range: {
      start: { x: pathMatch.start + 1, y: bufferLineNumber },
      end: { x: pathMatch.end, y: bufferLineNumber }
    },
    text: pathMatch.displayText,
    activate: () => {
      void state.options.openTerminalPath(pathMatch.resolvedPath, pathMatch.line, pathMatch.column);
    },
    decorations: { underline: true, pointerCursor: true }
  }));
}

function disposeTerminalPathLinkProvider(state: TerminalViewState) {
  state.terminalPathLinkProvider?.dispose();
  state.terminalPathLinkProvider = null;
}

function registerTerminalPathLinkProvider(state: TerminalViewState) {
  if (!state.terminal) {
    return;
  }
  disposeTerminalPathLinkProvider(state);
  state.terminalPathLinkProvider = state.terminal.registerLinkProvider({
    provideLinks(bufferLineNumber, callback) {
      callback(createTerminalPathLinks(state, bufferLineNumber));
    }
  });
}

function isCtrlKeyShortcut(event: KeyboardEvent, code: string) {
  return event.type === "keydown" && event.ctrlKey && !event.metaKey && !event.altKey && event.code === code;
}

async function pasteClipboardToTerminal(state: TerminalViewState) {
  try {
    const text = await navigator.clipboard.readText();
    if (text.length > 0) {
      await state.options.sendTerminalInput(`\x1b[200~${text}\x1b[201~`, "Не удалось вставить в терминал.");
    }
  } catch (error) {
    state.options.reportUiError("Terminal paste", error, "Не удалось вставить в терминал.");
  }
}

function bindTerminalInput(state: TerminalViewState, terminal: Terminal) {
  terminal.attachCustomKeyEventHandler((event) => {
    if (isCtrlKeyShortcut(event, "KeyC") && terminal.hasSelection()) {
      void copyTerminalSelectionIfAny(state);
      return false;
    }
    if (isCtrlKeyShortcut(event, "KeyV")) {
      event.preventDefault();
      void pasteClipboardToTerminal(state);
      return false;
    }

    return true;
  });

  terminal.onData((data) => {
    if (!state.options.isTerminalReady.value) {
      return;
    }

    void state.options.sendTerminalInput(data, DEFAULT_INPUT_ERROR);
  });

  terminal.onBell(() => {
    playTerminalBell();
    state.options.onBell?.();
  });
}

function startContainerResizeObserver(state: TerminalViewState, container: HTMLElement) {
  stopContainerResizeObserver(state);
  const observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    if (width > 0 && height > 0) {
      void resizeTerminalBackend(state);
    }
  });
  state.resizeObserver = observer;
  observer.observe(container);
}

function stopContainerResizeObserver(state: TerminalViewState) {
  state.resizeObserver?.disconnect();
  state.resizeObserver = null;
}

function initializeTerminalView(state: TerminalViewState) {
  const container = state.options.terminalContainer.value;
  if (state.terminal || !container) {
    return Boolean(state.terminal);
  }

  const terminal = createTerminal(state.options.getTerminalFontSize());
  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon((_event, uri) => {
    void window.projectApi.shell.openExternal(uri);
  });
  state.terminal = terminal;
  state.fitAddon = fitAddon;
  state.webLinksAddon = webLinksAddon;
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(container);
  const xtermTextarea = container.querySelector("textarea.xterm-helper-textarea");
  if (xtermTextarea instanceof HTMLElement) {
    xtermTextarea.tabIndex = -1;
  }
  registerTerminalPathLinkProvider(state);
  fitAddon.fit();
  terminal.writeln(INITIAL_TERMINAL_MESSAGE);
  bindTerminalInput(state, terminal);
  startContainerResizeObserver(state, container);
  return true;
}

function getTerminalSize(state: TerminalViewState) {
  const { terminal, fitAddon } = state;
  const container = state.options.terminalContainer.value;
  if (!terminal || !fitAddon || !container) {
    return null;
  }
  if (container.offsetWidth > 0 && container.offsetHeight > 0) {
    fitAddon.fit();
  }
  return { cols: terminal.cols, rows: terminal.rows };
}

function focusTerminal(state: TerminalViewState) {
  state.terminal?.focus();
}

function writeTerminalOutput(state: TerminalViewState, data: string) {
  state.terminal?.write(data);
}

function writeTerminalNotice(state: TerminalViewState, line: string) {
  state.terminal?.writeln(line);
}

function syncTerminalFontSize(state: TerminalViewState, fontSize: number) {
  if (!state.terminal || state.terminal.options.fontSize === fontSize) {
    return false;
  }

  state.terminal.options.fontSize = fontSize;
  return true;
}

async function copyTerminalSelectionIfAny(state: TerminalViewState): Promise<boolean> {
  const selectedText = state.terminal?.getSelection() ?? "";
  if (selectedText.length === 0) {
    return false;
  }
  try {
    const response = await state.options.writeClipboardText(selectedText);
    if (!response.ok) {
      state.options.reportUiError("Terminal copy", response.error, "Не удалось скопировать выделение терминала.");
      return false;
    }
  } catch (error) {
    state.options.reportUiError("Terminal copy", error, "Не удалось скопировать выделение терминала.");
    return false;
  }

  state.terminal?.clearSelection();
  return true;
}

function handleTerminalCopyEvent(state: TerminalViewState, event: MouseEvent) {
  if (event.type === "auxclick" && event.button !== 1) {
    return;
  }
  event.preventDefault();
  void copyTerminalSelectionIfAny(state);
}

async function resizeTerminalBackend(state: TerminalViewState) {
  const size = getTerminalSize(state);
  if (!size || !state.options.isTerminalReady.value) {
    return;
  }
  const response = await state.options.resizeTerminalBackendRequest(size).catch(() => null);
  if (response && !response.ok) {
    state.options.reportUiError("Terminal resize", response.error, "Не удалось изменить размер терминала.");
  }
}

function prepareTerminalStart(state: TerminalViewState) {
  if (!initializeTerminalView(state)) {
    return null;
  }
  const size = getTerminalSize(state);
  if (!size || !state.terminal) {
    return null;
  }
  state.terminal.clear();
  return size;
}

async function startTerminal(state: TerminalViewState, cwd: string) {
  state.options.isTerminalReady.value = false;
  const size = prepareTerminalStart(state);
  if (!size) {
    throw new Error(PREPARE_TERMINAL_ERROR);
  }

  state.options.resetTerminalSessionState();
  const response = await state.options.startTerminalBackendRequest(cwd, size);
  if (!response.ok) {
    throw new Error(response.error ?? START_TERMINAL_ERROR);
  }

  state.options.isTerminalReady.value = true;
  focusTerminal(state);
}

function disposeTerminalView(state: TerminalViewState) {
  stopContainerResizeObserver(state);
  disposeTerminalPathLinkProvider(state);
  state.terminal?.dispose();
  state.terminal = null;
  state.fitAddon = null;
  state.webLinksAddon = null;
}

export function useTerminalView(options: UseTerminalViewOptions) {
  const state = createTerminalViewState(options);
  return {
    startTerminal: startTerminal.bind(null, state),
    resizeTerminalBackend: resizeTerminalBackend.bind(null, state),
    focusTerminal: focusTerminal.bind(null, state),
    handleTerminalCopyEvent: handleTerminalCopyEvent.bind(null, state),
    copyTerminalSelectionIfAny: copyTerminalSelectionIfAny.bind(null, state),
    writeTerminalOutput: writeTerminalOutput.bind(null, state),
    writeTerminalNotice: writeTerminalNotice.bind(null, state),
    syncTerminalFontSize: syncTerminalFontSize.bind(null, state),
    disposeTerminalView: disposeTerminalView.bind(null, state)
  };
}
