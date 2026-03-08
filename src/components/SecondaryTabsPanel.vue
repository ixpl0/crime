<template>
  <div class="card min-h-0 flex-1 overflow-hidden bg-base-100 shadow-xl">
    <div class="card-body flex min-h-0 flex-col gap-4">
      <div role="tablist" class="tabs tabs-bordered shrink-0">
        <button
          role="tab"
          class="tab"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === 'terminal' }"
          @click="setActiveTab('terminal')"
        >
          Терминал
        </button>
        <button
          role="tab"
          class="tab"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === 'files' }"
          @click="setActiveTab('files')"
        >
          Файлы
        </button>
        <button
          role="tab"
          class="tab"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === 'changes' }"
          @click="setActiveTab('changes')"
        >
          Изменения
          <span v-if="changesCount > 0" class="badge badge-xs badge-primary ml-1">{{ changesCount }}</span>
        </button>
        <button
          role="tab"
          class="tab"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === 'git' }"
          @click="setActiveTab('git')"
        >
          Гит
        </button>
      </div>

      <!-- Teleport target: non-agent tab content is teleported here when detached -->
      <div id="secondary-tabs-content" class="flex min-h-0 flex-1 flex-col gap-4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppNavigationStore } from "../navigation/navigation-store";

defineProps<{
  changesCount: number;
}>();

const { activeTab, setActiveTab } = useAppNavigationStore();
</script>
