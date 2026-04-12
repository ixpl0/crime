import { ref, type Ref } from "vue";
import { type ToolbarAction } from "../types/toolbar";
import { useAppToastStore, type AppToastStore } from "../toast/toast-store";

const MAX_TOAST_OUTPUT_LENGTH = 240;
const SUCCESS_TOAST_DURATION_MS = 4500;
const ERROR_TOAST_DURATION_MS = 8000;

interface SilentToolbarCommandDeps {
  readonly projectPath: Readonly<Ref<string>>;
}

function pickFirstNonEmptyLines(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}…`;
}

function buildSuccessMessage(label: string, stdout: string): string {
  const preview = pickFirstNonEmptyLines(stdout, MAX_TOAST_OUTPUT_LENGTH);
  if (preview.length === 0) {
    return `${label}: выполнено`;
  }

  return `${label}:\n${preview}`;
}

function buildErrorMessage(label: string, code: number, stderr: string, stdout: string): string {
  const stderrPreview = pickFirstNonEmptyLines(stderr, MAX_TOAST_OUTPUT_LENGTH);
  if (stderrPreview.length > 0) {
    return `${label} (код ${String(code)}):\n${stderrPreview}`;
  }

  const stdoutPreview = pickFirstNonEmptyLines(stdout, MAX_TOAST_OUTPUT_LENGTH);
  if (stdoutPreview.length > 0) {
    return `${label} (код ${String(code)}):\n${stdoutPreview}`;
  }

  return `${label}: код ${String(code)}`;
}

function reportSilentCommandResult(
  toastStore: AppToastStore,
  action: ToolbarAction,
  response: CommandRunSilentResponse
): void {
  if (!response.ok) {
    toastStore.pushError(`${action.label}: ${response.error ?? "ошибка выполнения"}`, {
      durationMs: ERROR_TOAST_DURATION_MS
    });
    return;
  }

  const code = response.code ?? -1;
  const stdout = response.stdout ?? "";
  const stderr = response.stderr ?? "";
  if (code === 0) {
    toastStore.pushToast(buildSuccessMessage(action.label, stdout), {
      tone: "success",
      durationMs: SUCCESS_TOAST_DURATION_MS
    });
    return;
  }

  toastStore.pushError(buildErrorMessage(action.label, code, stderr, stdout), {
    durationMs: ERROR_TOAST_DURATION_MS
  });
}

function createPendingActionsController(
  pendingActions: Ref<ReadonlySet<ToolbarAction>>
) {
  const isPending = (action: ToolbarAction): boolean => pendingActions.value.has(action);

  const markPending = (action: ToolbarAction, isStarting: boolean) => {
    const nextSet = new Set(pendingActions.value);
    if (isStarting) {
      nextSet.add(action);
    } else {
      nextSet.delete(action);
    }
    pendingActions.value = nextSet;
  };

  return { isPending, markPending };
}

export function useSilentToolbarCommand({ projectPath }: SilentToolbarCommandDeps) {
  const toastStore = useAppToastStore();
  const pendingActions = ref<ReadonlySet<ToolbarAction>>(new Set());
  const { isPending, markPending } = createPendingActionsController(pendingActions);

  const runSilentCommand = async (action: ToolbarAction): Promise<void> => {
    const commandLine = action.value.trim();
    if (commandLine.length === 0 || isPending(action)) {
      return;
    }

    markPending(action, true);
    try {
      const response = await window.projectApi.command.runSilent(commandLine, projectPath.value);
      reportSilentCommandResult(toastStore, action, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      toastStore.pushError(`${action.label}: ${message}`, { durationMs: ERROR_TOAST_DURATION_MS });
    } finally {
      markPending(action, false);
    }
  };

  return {
    pendingActions,
    runSilentCommand
  };
}
