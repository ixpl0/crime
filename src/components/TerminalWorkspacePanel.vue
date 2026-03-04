<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-1">
    <div v-if="panelErrorMessage" class="alert alert-error">
      <span>{{ panelErrorMessage }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <ToolbarPanel
        :toolbar-config="terminalToolbarConfig"
        :is-terminal-ready="true"
        @execute-action="executeTerminalToolbarAction"
        @open-config-editor="openTerminalToolbarConfigEditor"
      />

      <button class="btn btn-sm btn-outline" type="button" tabindex="-1" @click="createBlankTerminal">
        New terminal
      </button>

      <button
        v-if="sessions.length > 0"
        class="btn btn-sm btn-ghost"
        type="button"
        tabindex="-1"
        @click="closeAllSessions"
      >
        Clear
      </button>
    </div>

    <div
      v-if="sessions.length === 0"
      class="flex min-h-0 flex-1 items-center justify-center rounded-box border border-dashed border-base-300 bg-base-200/60 p-6 text-center text-sm opacity-70"
    >
      Use the toolbar above or create a blank terminal.
    </div>

    <div
      v-else
      class="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1"
      :class="
        sessions.length > 1
          ? 'grid-cols-2 auto-rows-[minmax(18rem,1fr)]'
          : 'grid-cols-1 auto-rows-[minmax(18rem,1fr)]'
      "
    >
      <section
        v-for="session in sessions"
        :key="session.id"
        class="card min-h-[18rem] overflow-hidden border border-base-300 bg-base-100 shadow-sm"
      >
        <div class="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
          <div class="min-w-0 flex-1 truncate text-sm font-semibold">{{ session.title }}</div>

          <div class="flex items-center gap-2">
            <button
              v-if="session.initialCommandText"
              class="btn btn-xs"
              tabindex="-1"
              :class="getToolbarButtonColorClass(session.repeatButtonColor)"
              :style="getToolbarButtonCustomStyle(session.repeatButtonColor)"
              type="button"
              @click="restartSession(session.id)"
            >
              {{ session.title }}
              <RotateCw :size="12" />
            </button>
            <button class="btn btn-xs btn-ghost" type="button" tabindex="-1" @click="closeSession(session.id)">
              Close
            </button>
          </div>
        </div>

        <div
          :ref="(element) => setSessionContainer(session.id, element)"
          class="terminal-host min-h-0 flex-1"
          @click="focusSession(session.id)"
          @contextmenu="handleSessionContextMenu(session.id, $event)"
          @auxclick="handleSessionAuxClick(session.id, $event)"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable max-lines */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type ComponentPublicInstance,
  type Ref
} from "vue";
import { RotateCw } from "lucide-vue-next";
import { useAppConfigStore } from "../config/config-store";
import { normalizeTerminalFontSize } from "../layout/project-layout-utils";
import {
  getToolbarButtonColorClass,
  getToolbarButtonCustomStyle
} from "../toolbar/toolbar-button-styles";
import { useTerminalView } from "../terminal/use-terminal-view";
import {
  type ToolbarAction,
  type ToolbarButtonColor
} from "../types/toolbar";
import { toContextualErrorMessage } from "../utils/fail-fast";
import ToolbarPanel from "./ToolbarPanel.vue";

interface WorkspaceSession {
  id: string;
  title: string;
  initialCommandText: string;
  initialShouldSubmit: boolean;
  repeatButtonColor?: ToolbarButtonColor;
  terminalContainer: Ref<HTMLElement | null>;
  isTerminalReady: Ref<boolean>;
  startTerminal: (cwd: string) => Promise<void>;
  resizeTerminalBackend: () => Promise<void>;
  focusTerminal: () => void;
  handleTerminalContextMenu: (event: MouseEvent) => void;
  handleTerminalAuxClick: (event: MouseEvent) => void;
  writeTerminalOutput: (data: string) => void;
  writeTerminalNotice: (line: string) => void;
  syncTerminalFontSize: (fontSize: number) => boolean;
  disposeTerminalView: () => void;
}

const PRIMARY_TERMINAL_SESSION_ID = "primary";

const props = defineProps<{
  projectPath: string;
  isActive: boolean;
}>();

const {
  projectSettings,
  terminalToolbarConfig,
  openTerminalToolbarConfigEditor
} = useAppConfigStore();

const panelErrorMessage = ref("");
const sessions = shallowRef<WorkspaceSession[]>([]);
const projectPathRef = computed<string | null>(() => props.projectPath);
const terminalFontSize = computed(() =>
  normalizeTerminalFontSize(projectSettings.value.zoom.terminalFontSize)
);

let nextSessionNumber = 1;

const stopTerminalDataSubscription = window.projectApi.terminal.onData((data, sessionId) => {
  if (sessionId === PRIMARY_TERMINAL_SESSION_ID) {
    return;
  }

  const session = getSessionById(sessionId);
  if (!session) {
    return;
  }

  session.writeTerminalOutput(data);
});

const stopTerminalExitSubscription = window.projectApi.terminal.onExit((code, sessionId) => {
  if (sessionId === PRIMARY_TERMINAL_SESSION_ID) {
    return;
  }

  const session = getSessionById(sessionId);
  if (!session) {
    return;
  }

  session.isTerminalReady.value = false;
  session.writeTerminalNotice(`\r\n[terminal exited: ${String(code ?? "unknown")}]`);
});

watch(
  () => props.isActive,
  (isActive) => {
    if (!isActive) {
      return;
    }

    void nextTick(() => {
      void resizeAllSessions();
    });
  }
);

watch(
  () => props.projectPath,
  (nextPath, previousPath) => {
    if (!previousPath || nextPath === previousPath) {
      return;
    }

    panelErrorMessage.value = "";
    void closeAllSessions();
  }
);

watch(terminalFontSize, (fontSize) => {
  for (const session of sessions.value) {
    if (!session.syncTerminalFontSize(fontSize)) {
      continue;
    }

    void session.resizeTerminalBackend();
  }
});

onBeforeUnmount(() => {
  stopTerminalDataSubscription();
  stopTerminalExitSubscription();
  void disposeAllSessions();
});

function reportPanelError(context: string, error: unknown, fallbackMessage: string): string {
  const message = toContextualErrorMessage(context, error, fallbackMessage);
  panelErrorMessage.value = message;
  console.error(message, error);
  return message;
}

function resolveActionColor(action: ToolbarAction): ToolbarButtonColor | undefined {
  for (const element of terminalToolbarConfig.value.elements) {
    if ("items" in element) {
      if (element.items.includes(action)) {
        return element.color;
      }

      continue;
    }

    if (element === action) {
      return element.color;
    }
  }

  return action.color;
}

function createWorkspaceSession(title: string, commandText: string): WorkspaceSession {
  const sessionNumber = nextSessionNumber++;
  const sessionId = ["mini", String(Date.now()), String(sessionNumber)].join("-");
  const terminalContainer = ref<HTMLElement | null>(null); const isTerminalReady = ref(false);
  const terminalView = useTerminalView({
    terminalContainer,
    projectPath: projectPathRef,
    isTerminalReady,
    getTerminalFontSize: () => terminalFontSize.value,
    sendTerminalInput: async (data, fallbackMessage) =>
      sendInputToSession(sessionId, data, fallbackMessage),
    openTerminalPath: async () => {},
    reportUiError: reportPanelError,
    writeClipboardText: (text) => window.projectApi.clipboard.writeText(text),
    resizeTerminalBackendRequest: (size) =>
      window.projectApi.terminal.resize(size, sessionId),
    startTerminalBackendRequest: (cwd, size) =>
      window.projectApi.terminal.start(cwd, size, sessionId),
    resetTerminalSessionState: () => {}
  });
  return {
    id: sessionId,
    title: title.trim().length > 0 ? title : `Terminal ${String(sessionNumber)}`,
    initialCommandText: commandText,
    initialShouldSubmit: false,
    terminalContainer,
    isTerminalReady,
    ...terminalView
  };
}

async function sendInputToSession(
  sessionId: string,
  data: string,
  fallbackMessage: string
): Promise<boolean> {
  try {
    const response = await window.projectApi.terminal.input(data, sessionId);
    if (!response.ok) {
      reportPanelError("Mini terminal input", response.error, fallbackMessage);
      return false;
    }

    return true;
  } catch (error) {
    reportPanelError("Mini terminal input", error, fallbackMessage);
    return false;
  }
}

async function runInitialSessionAction(
  sessionId: string,
  commandText: string,
  shouldSubmit: boolean
): Promise<void> {
  if (commandText.length === 0) {
    return;
  }

  const didSendInput = await sendInputToSession(
    sessionId,
    commandText,
    "Failed to send command to mini terminal."
  );
  if (!didSendInput || !shouldSubmit) {
    return;
  }

  await sendInputToSession(
    sessionId,
    "\r",
    "Failed to submit command in mini terminal."
  );
}

async function createTerminalSession(options?: {
  title?: string;
  commandText?: string;
  shouldSubmit?: boolean;
  repeatButtonColor?: ToolbarButtonColor;
}) {
  const title = options?.title ?? "";
  const commandText = options?.commandText ?? "";
  const shouldSubmit = options?.shouldSubmit ?? false;
  const session = createWorkspaceSession(title, commandText);
  session.initialShouldSubmit = shouldSubmit;
  session.repeatButtonColor = options?.repeatButtonColor;
  sessions.value = [...sessions.value, session];
  await nextTick();

  try {
    await session.startTerminal(props.projectPath);
    await runInitialSessionAction(session.id, commandText, shouldSubmit);
    if (props.isActive) {
      await session.resizeTerminalBackend();
    }
  } catch (error) {
    session.writeTerminalNotice("\r\n[start failed]");
    reportPanelError("Mini terminal start", error, "Failed to start mini terminal.");
  }
}

function executeTerminalToolbarAction(action: ToolbarAction) {
  void createTerminalSession({
    title: action.label,
    commandText: action.value,
    shouldSubmit: action.type !== "raw-input",
    repeatButtonColor: resolveActionColor(action)
  });
}

function createBlankTerminal() {
  void createTerminalSession();
}

function getSessionById(sessionId: string): WorkspaceSession | undefined {
  return sessions.value.find((session) => session.id === sessionId);
}

function setSessionContainer(
  sessionId: string,
  element: Element | ComponentPublicInstance | null
) {
  const session = getSessionById(sessionId);
  if (!session) {
    return;
  }

  session.terminalContainer.value = element instanceof HTMLElement ? element : null;
}

function focusSession(sessionId: string) {
  getSessionById(sessionId)?.focusTerminal();
}

function handleSessionContextMenu(sessionId: string, event: MouseEvent) {
  getSessionById(sessionId)?.handleTerminalContextMenu(event);
}

function handleSessionAuxClick(sessionId: string, event: MouseEvent) {
  getSessionById(sessionId)?.handleTerminalAuxClick(event);
}

async function closeSession(sessionId: string) {
  const session = getSessionById(sessionId);
  if (!session) {
    return;
  }

  sessions.value = sessions.value.filter((item) => item.id !== sessionId);
  session.disposeTerminalView();

  try {
    await window.projectApi.terminal.stop(sessionId);
  } catch (error) {
    reportPanelError("Mini terminal stop", error, "Failed to stop mini terminal.");
  }
}

async function restartSession(sessionId: string) {
  const session = getSessionById(sessionId);
  if (!session || session.initialCommandText.length === 0) {
    return;
  }

  session.isTerminalReady.value = false;

  try {
    await window.projectApi.terminal.stop(sessionId);
    await session.startTerminal(props.projectPath);
    await runInitialSessionAction(
      session.id,
      session.initialCommandText,
      session.initialShouldSubmit
    );
    if (props.isActive) {
      await session.resizeTerminalBackend();
    }
  } catch (error) {
    session.writeTerminalNotice("\r\n[restart failed]");
    reportPanelError("Mini terminal restart", error, "Failed to restart mini terminal.");
  }
}

async function closeAllSessions() {
  const sessionIds = sessions.value.map((session) => session.id);
  for (const sessionId of sessionIds) {
    await closeSession(sessionId);
  }
}

async function resizeAllSessions() {
  for (const session of sessions.value) {
    if (!session.isTerminalReady.value) {
      continue;
    }

    await session.resizeTerminalBackend();
  }
}

async function disposeAllSessions() {
  const activeSessions = [...sessions.value];
  sessions.value = [];

  for (const session of activeSessions) {
    session.disposeTerminalView();

    try {
      await window.projectApi.terminal.stop(session.id);
    } catch (error) {
      reportPanelError("Mini terminal stop", error, "Failed to stop mini terminal.");
    }
  }
}
</script>
