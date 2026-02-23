<template>
  <div class="flex h-96 flex-col rounded-box border border-base-300 bg-base-200">
    <div class="flex items-center gap-2 border-b border-base-300 px-3 py-2">
      <span class="truncate text-sm font-medium">
        {{ filePath ? fileName : "File preview" }}
      </span>
      <span v-if="filePath" class="ml-auto truncate text-xs text-base-content/60">
        {{ filePath }}
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="!filePath" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        Select a file in the tree to preview it.
      </div>

      <div v-else-if="isLoading" class="flex h-full items-center justify-center">
        <span class="loading loading-spinner loading-md" />
      </div>

      <div v-else-if="loadError" class="px-4 py-3 text-sm text-error">
        {{ loadError }}
      </div>

      <div v-else-if="displayLines.length === 0" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        File is empty.
      </div>

      <div v-else class="font-mono text-sm">
        <div
          v-for="(line, index) in displayLines"
          :key="`${line.type}:${String(index)}:${line.text}`"
          class="flex"
          :class="lineRowClasses(line.type)"
        >
          <span class="w-12 shrink-0 select-none border-r border-base-300/50 px-2 py-0.5 text-right text-xs text-base-content/50">
            {{ index + 1 }}
          </span>

          <span class="flex-1 whitespace-pre px-3 py-0.5">
            <span class="mr-2 inline-block w-2 select-none opacity-80">
              {{ linePrefix(line.type) }}
            </span>
            {{ line.text }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="diffInfoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ diffInfoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  projectPath: string;
  filePath: string | null;
  isActive: boolean;
}>();

type ViewerLine = GitDiffLine;

const isLoading = ref(false);
const loadError = ref("");
const diffInfoMessage = ref("");
const displayLines = ref<ViewerLine[]>([]);
let loadRequestId = 0;

const fileName = computed(() => {
  if (!props.filePath) {
    return "";
  }

  const segments = props.filePath.split(/[\\/]/);
  return segments[segments.length - 1] ?? props.filePath;
});

function toContextLines(content: string): ViewerLine[] {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.map((line) => ({ type: "context", text: line }));
}

function linePrefix(type: ViewerLine["type"]) {
  if (type === "added") {
    return "+";
  }

  if (type === "removed") {
    return "-";
  }

  return "";
}

function lineRowClasses(type: ViewerLine["type"]) {
  if (type === "added") {
    return "bg-green-500/10 text-green-700";
  }

  if (type === "removed") {
    return "bg-red-500/10 text-red-700";
  }

  return "text-base-content";
}

async function loadFilePreview() {
  const requestId = ++loadRequestId;

  if (!props.filePath) {
    isLoading.value = false;
    loadError.value = "";
    diffInfoMessage.value = "";
    displayLines.value = [];
    return;
  }

  if (!props.isActive) {
    return;
  }

  isLoading.value = true;
  loadError.value = "";
  diffInfoMessage.value = "";

  const [fileResponse, diffResponse] = await Promise.all([
    window.projectApi.filesystem.readFile(props.projectPath, props.filePath),
    window.projectApi.git.getFileDiff(props.projectPath, props.filePath)
  ]);

  if (requestId !== loadRequestId) {
    return;
  }

  isLoading.value = false;

  const fallbackLines =
    fileResponse.ok && typeof fileResponse.content === "string"
      ? toContextLines(fileResponse.content)
      : [];

  if (!diffResponse.ok) {
    displayLines.value = fallbackLines;
    diffInfoMessage.value = diffResponse.error
      ? `Git diff unavailable: ${diffResponse.error}`
      : "Git diff unavailable.";

    if (!fileResponse.ok) {
      loadError.value = fileResponse.error ?? "Failed to read file.";
    }
    return;
  }

  if (!diffResponse.available) {
    displayLines.value = fallbackLines;
    if (diffResponse.reason === "git-not-installed") {
      diffInfoMessage.value = "Git is not installed. Showing plain file content.";
    } else {
      diffInfoMessage.value = "Selected folder is not a Git repository.";
    }

    if (!fileResponse.ok) {
      loadError.value = fileResponse.error ?? "Failed to read file.";
    }
    return;
  }

  const diffLines = diffResponse.lines ?? [];
  if (diffLines.length > 0) {
    displayLines.value = diffLines;
    return;
  }

  displayLines.value = fallbackLines;

  if (!fileResponse.ok) {
    loadError.value = fileResponse.error ?? "Failed to read file.";
  }
}

watch(
  () => [props.projectPath, props.filePath, props.isActive],
  () => {
    void loadFilePreview();
  },
  { immediate: true }
);
</script>
