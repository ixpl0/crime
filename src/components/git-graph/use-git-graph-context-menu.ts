import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";
import { clampContextMenuX, clampContextMenuY } from "../../utils/context-menu-utils";
import { useContextMenuDragRegionBackdrop } from "../../utils/dropdown-utils";

export interface ContextMenuTargetBranch {
  displayName: string;
  branchName: string;
  remote: string | null;
}

export interface GitGraphContextMenuState {
  x: number;
  y: number;
  hash: string;
  targetBranch: ContextMenuTargetBranch | null;
}

export function parseBranchRef(refName: string, remotes: readonly string[]): ContextMenuTargetBranch | null {
  if (refName === "HEAD" || refName.startsWith("tag: ")) {
    return null;
  }

  if (refName.startsWith("HEAD -> ")) {
    const name = refName.slice(8);
    return { displayName: name, branchName: name, remote: null };
  }

  for (const remote of remotes) {
    const prefix = `${remote}/`;
    if (refName.startsWith(prefix)) {
      return {
        displayName: refName,
        branchName: refName.slice(prefix.length),
        remote
      };
    }
  }

  return { displayName: refName, branchName: refName, remote: null };
}

// eslint-disable-next-line max-lines-per-function
export function useGitGraphContextMenu(projectPath: Ref<string>, remotes: Ref<readonly string[]>) {
  const contextMenu = ref<GitGraphContextMenuState | null>(null);
  const contextMenuElement = ref<HTMLElement | null>(null);

  function closeContextMenu() {
    contextMenu.value = null;
  }

  useContextMenuDragRegionBackdrop(contextMenu, closeContextMenu);

  function openContextMenu(event: MouseEvent, hash: string, targetRef?: string) {
    event.preventDefault();
    contextMenu.value = {
      x: clampContextMenuX(event.clientX),
      y: clampContextMenuY(event.clientY),
      hash,
      targetBranch: targetRef ? parseBranchRef(targetRef, remotes.value) : null
    };
    void nextTick(() => {
      contextMenuElement.value?.focus();
    });
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    if (!contextMenu.value) {
      return;
    }
    const target = event.target;
    if (contextMenuElement.value && target instanceof Node && contextMenuElement.value.contains(target)) {
      return;
    }
    closeContextMenu();
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeContextMenu();
    }
  }

  async function checkout(
    target: string,
    remote?: string | null
  ): Promise<{ ok: boolean; stashConflict?: boolean; conflictFiles?: string[]; error?: string }> {
    closeContextMenu();
    try {
      const response = await window.projectApi.git.checkout(projectPath.value, target, remote ?? undefined);
      if (!response.ok) {
        return { ok: false, error: response.error ?? "Не удалось переключиться." };
      }
      return {
        ok: true,
        stashConflict: response.stashConflict ?? false,
        conflictFiles: response.conflictFiles ?? []
      };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Не удалось переключиться.") };
    }
  }

  async function createBranch(
    hash: string,
    requestBranchName: () => Promise<string | null>
  ): Promise<{ ok: boolean; error?: string }> {
    closeContextMenu();
    const branchName = await requestBranchName();
    if (!branchName) {
      return { ok: false };
    }

    try {
      const response = await window.projectApi.git.createBranch(projectPath.value, branchName, hash);
      if (!response.ok) {
        return { ok: false, error: response.error ?? "Не удалось создать ветку." };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Не удалось создать ветку.") };
    }
  }

  async function deleteBranch(
    branch: ContextMenuTargetBranch,
    requestConfirmation: () => Promise<boolean>
  ): Promise<{ ok: boolean; error?: string }> {
    closeContextMenu();
    const confirmed = await requestConfirmation();
    if (!confirmed) {
      return { ok: false };
    }

    try {
      const response = branch.remote
        ? await window.projectApi.git.deleteRemoteBranch(projectPath.value, branch.remote, branch.branchName)
        : await window.projectApi.git.deleteBranch(projectPath.value, branch.branchName);
      if (!response.ok) {
        return { ok: false, error: response.error ?? "Не удалось удалить ветку." };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Не удалось удалить ветку.") };
    }
  }

  onMounted(() => {
    window.addEventListener("pointerdown", handleGlobalPointerDown, true);
    window.addEventListener("keydown", handleGlobalKeydown, true);
    window.addEventListener("scroll", closeContextMenu, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    window.removeEventListener("keydown", handleGlobalKeydown, true);
    window.removeEventListener("scroll", closeContextMenu, true);
  });

  return {
    contextMenu,
    contextMenuElement,
    openContextMenu,
    checkout,
    createBranch,
    deleteBranch
  };
}
