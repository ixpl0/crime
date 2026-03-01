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

type TerminalCopyClickType = "right" | "middle";

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
};

type TerminalViewState = {
  options: UseTerminalViewOptions;
  terminal: Terminal | null;
  fitAddon: FitAddon | null;
  webLinksAddon: WebLinksAddon | null;
  terminalPathLinkProvider: { dispose: () => void } | null;
};

const DEFAULT_INPUT_ERROR = "Failed to send input to terminal.";
const INITIAL_TERMINAL_MESSAGE =
  "\u0422\u0435\u0440\u043c\u0438\u043d\u0430\u043b \u0433\u043e\u0442\u043e\u0432. " +
  "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0430\u043f\u043a\u0443 " +
  "\u043f\u0440\u043e\u0435\u043a\u0442\u0430.";
const PREPARE_TERMINAL_ERROR =
  "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c " +
  "\u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u044c " +
  "\u043e\u043a\u043d\u043e \u0442\u0435\u0440\u043c\u0438\u043d\u0430\u043b\u0430.";
const START_TERMINAL_ERROR =
  "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c " +
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0442\u0435\u0440\u043c\u0438\u043d\u0430\u043b.";

function createTerminal(fontSize: number) {
  return new Terminal({
    convertEol: true,
    cursorBlink: true,
    cursorStyle: "bar",
    cursorInactiveStyle: "none",
    cursorWidth: 2,
    fontFamily: "Cascadia Mono, Consolas, monospace",
    fontSize,
    theme: { background: "#05070d", foreground: "#e5e7eb", cursor: "#e5e7eb" }
  });
}

function createTerminalViewState(options: UseTerminalViewOptions): TerminalViewState {
  return {
    options,
    terminal: null,
    fitAddon: null,
    webLinksAddon: null,
    terminalPathLinkProvider: null
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

function bindTerminalInput(state: TerminalViewState, terminal: Terminal) {
  terminal.onData((data) => {
    if (!state.options.isTerminalReady.value) {
      return;
    }

    void state.options.sendTerminalInput(data, DEFAULT_INPUT_ERROR);
  });

  terminal.onBell(playTerminalBell);
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
  return true;
}

function getTerminalSize(state: TerminalViewState) {
  const { terminal, fitAddon } = state;
  if (!terminal || !fitAddon) {
    return null;
  }

  fitAddon.fit();
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

function reportClipboardWriteFailure(
  state: TerminalViewState,
  clickType: TerminalCopyClickType,
  error: unknown
) {
  state.options.reportUiError(
    "Terminal copy",
    error,
    `Failed to copy terminal selection with ${clickType} click.`
  );
}

async function copyTerminalSelection(state: TerminalViewState, clickType: TerminalCopyClickType) {
  const selectedText = state.terminal?.getSelection() ?? "";
  if (selectedText.length === 0) {
    return;
  }

  try {
    const response = await state.options.writeClipboardText(selectedText);
    if (!response.ok) {
      reportClipboardWriteFailure(state, clickType, response.error);
    }
  } catch (error) {
    reportClipboardWriteFailure(state, clickType, error);
  }
}

function handleTerminalContextMenu(state: TerminalViewState, event: MouseEvent) {
  event.preventDefault();
  void copyTerminalSelection(state, "right");
}

function handleTerminalAuxClick(state: TerminalViewState, event: MouseEvent) {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
  void copyTerminalSelection(state, "middle");
}

async function sendTerminalResize(state: TerminalViewState, size: TerminalSize) {
  try {
    const response = await state.options.resizeTerminalBackendRequest(size);
    if (!response.ok) {
      state.options.reportUiError("Terminal resize", response.error, "Failed to resize terminal backend.");
    }
  } catch (error) {
    state.options.reportUiError("Terminal resize", error, "Failed to resize terminal backend.");
  }
}

async function resizeTerminalBackend(state: TerminalViewState) {
  const size = getTerminalSize(state);
  if (!size || !state.options.isTerminalReady.value) {
    return;
  }

  await sendTerminalResize(state, size);
}

function prepareTerminalStart(state: TerminalViewState) {
  if (!initializeTerminalView(state)) {
    return null;
  }

  const { terminal } = state;
  const size = getTerminalSize(state);
  if (!size || !terminal) {
    return null;
  }

  terminal.clear();
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
    handleTerminalContextMenu: handleTerminalContextMenu.bind(null, state),
    handleTerminalAuxClick: handleTerminalAuxClick.bind(null, state),
    writeTerminalOutput: writeTerminalOutput.bind(null, state),
    writeTerminalNotice: writeTerminalNotice.bind(null, state),
    syncTerminalFontSize: syncTerminalFontSize.bind(null, state),
    disposeTerminalView: disposeTerminalView.bind(null, state)
  };
}
