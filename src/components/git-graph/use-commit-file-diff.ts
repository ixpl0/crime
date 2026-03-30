import { ref, type Ref } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";

export interface CommitFileDiffState {
  selectedFilePath: string | null;
  lines: readonly GitDiffLine[];
  isLoading: boolean;
  error: string;
}

const EMPTY_STATE: CommitFileDiffState = { selectedFilePath: null, lines: [], isLoading: false, error: "" };

const toFileDiffState = (filePath: string, response: GitFileDiffResponse): CommitFileDiffState =>
  response.ok
    ? { selectedFilePath: filePath, lines: response.lines ?? [], isLoading: false, error: "" }
    : { selectedFilePath: filePath, lines: [], isLoading: false, error: response.error ?? "Не удалось загрузить diff файла." };

export function useCommitFileDiff(
  projectPath: Ref<string>,
  selectedCommitDetails: Ref<GitCommitDetails | null>
) {
  const fileDiff = ref<CommitFileDiffState>({ ...EMPTY_STATE });
  let requestId = 0;

  const clear = () => {
    requestId += 1;
    fileDiff.value = EMPTY_STATE;
  };

  const selectFile = async (filePath: string) => {
    const details = selectedCommitDetails.value;
    if (!details) { return; }
    if (fileDiff.value.selectedFilePath === filePath) { clear(); return; }
    const id = ++requestId;
    fileDiff.value = { selectedFilePath: filePath, lines: [], isLoading: true, error: "" };
    try {
      const response = await window.projectApi.git.getCommitFileDiff(projectPath.value, details.hash, filePath);
      if (id === requestId) { fileDiff.value = toFileDiffState(filePath, response); }
    } catch (error) {
      if (id === requestId) {
        fileDiff.value = { selectedFilePath: filePath, lines: [], isLoading: false, error: toErrorMessage(error, "Не удалось загрузить diff файла.") };
      }
    }
  };

  return { fileDiff, selectFile, clearFileDiff: clear };
}
