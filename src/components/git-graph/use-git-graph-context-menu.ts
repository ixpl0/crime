import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";
import { clampContextMenuX, clampContextMenuY } from "../../utils/context-menu-utils";

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

function parseBranchRef(refName: string): ContextMenuTargetBranch | null {
  if (refName === "HEAD" || refName.startsWith("tag: ")) {
    return null;
  }

  if (refName.startsWith("HEAD -> ")) {
    const name = refName.slice(8);
    return { displayName: name, branchName: name, remote: null };
  }

  const slashIndex = refName.indexOf("/");
  if (slashIndex > 0) {
    return {
      displayName: refName,
      branchName: refName.slice(slashIndex + 1),
      remote: refName.slice(0, slashIndex)
    };
  }

  return { displayName: refName, branchName: refName, remote: null };
}

// eslint-disable-next-line max-lines-per-function
export function useGitGraphContextMenu(projectPath: Ref<string>) {
  const contextMenu = ref<GitGraphContextMenuState | null>(null);
  const contextMenuElement = ref<HTMLElement | null>(null);

  function closeContextMenu() {
    contextMenu.value = null;
  }

  function openContextMenu(event: MouseEvent, hash: string, targetRef?: string) {
    event.preventDefault();
    contextMenu.value = {
      x: clampContextMenuX(event.clientX),
      y: clampContextMenuY(event.clientY),
      hash,
      targetBranch: targetRef ? parseBranchRef(targetRef) : null
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
    target: string
  ): Promise<{ ok: boolean; stashConflict?: boolean; conflictFiles?: string[]; error?: string }> {
    closeContextMenu();
    try {
      const response = await window.projectApi.git.checkout(projectPath.value, target);
      if (!response.ok) {
        return { ok: false, error: response.error ?? "Failed to checkout." };
      }
      return {
        ok: true,
        stashConflict: response.stashConflict ?? false,
        conflictFiles: response.conflictFiles ?? []
      };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Failed to checkout.") };
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
        return { ok: false, error: response.error ?? "Failed to create branch." };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Failed to create branch.") };
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
        return { ok: false, error: response.error ?? "Failed to delete branch." };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Failed to delete branch.") };
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
