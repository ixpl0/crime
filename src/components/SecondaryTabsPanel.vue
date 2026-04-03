<template>
  <div class="card min-h-0 flex-1 overflow-hidden bg-base-100 shadow-xl">
    <div class="card-body flex min-h-0 flex-col gap-2 p-3">
      <div role="tablist" class="tabs tabs-bordered tabs-sm shrink-0 flex-wrap">
        <button
          type="button"
          class="icon-btn mr-2 text-base-content/40 hover:text-primary"
          tabindex="-1"
          title="Вернуть во вкладку"
          @click="dockAgent"
        >
          <PanelLeftClose :size="16" />
        </button>
        <button
            role="tab"
            class="tab"
            tabindex="-1"
            :class="{ 'tab-active': activeTab === 'terminal' }"
            @click="setActiveTab('terminal')"
          >
            Терминал
            <span v-if="terminalSessionCount > 0" class="badge badge-xs badge-secondary ml-1">{{ terminalSessionCount }}</span>
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
      <div id="secondary-tabs-content" class="flex min-h-0 flex-1 flex-col gap-2" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PanelLeftClose } from "lucide-vue-next";
import { useAppNavigationStore } from "../navigation/navigation-store";

defineProps<{
  changesCount: number;
  terminalSessionCount: number;
}>();

const { activeTab, setActiveTab, dockAgent } = useAppNavigationStore();
</script>
