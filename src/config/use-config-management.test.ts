import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useConfigManagement } from "./use-config-management";

vi.mock("../toolbar/toolbar-storage", () => ({
  defaultToolbarConfig: { actions: [] },
  saveToolbarConfig: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../toolbar/terminal-toolbar-storage", () => ({
  defaultTerminalToolbarConfig: { actions: [] },
  saveTerminalToolbarConfig: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../toolbar/git-toolbar-storage", () => ({
  defaultGitToolbarConfig: { actions: [] },
  saveGitToolbarConfig: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../prompt-suffix/prompt-suffix-storage", () => ({
  defaultPromptSuffixConfig: { items: [] },
  savePromptSuffixConfig: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../settings/project-settings-storage", () => ({
  defaultProjectSettings: { slashCommand: {}, zoom: {}, bellReminder: {} },
  saveProjectSettings: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../settings/secrets-storage", () => ({
  defaultSecretsContent: "",
  saveSecrets: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../toolbar/toolbar-tracking", () => ({
  applyToolbarActionTracking: vi.fn().mockReturnValue(null)
}));

const createConfigManagement = () =>
  useConfigManagement({
    projectPath: ref<string | null>("/project"),
    reportUiError: vi.fn().mockReturnValue("error reported")
  });

describe("editor open/close toggles", () => {
  it("toggles toolbar config editor", () => {
    const cm = createConfigManagement();
    expect(cm.isToolbarConfigEditorOpen.value).toBe(false);
    cm.openToolbarConfigEditor();
    expect(cm.isToolbarConfigEditorOpen.value).toBe(true);
    cm.closeToolbarConfigEditor();
    expect(cm.isToolbarConfigEditorOpen.value).toBe(false);
  });

  it("toggles terminal toolbar config editor", () => {
    const cm = createConfigManagement();
    cm.openTerminalToolbarConfigEditor();
    expect(cm.isTerminalToolbarConfigEditorOpen.value).toBe(true);
    cm.closeTerminalToolbarConfigEditor();
    expect(cm.isTerminalToolbarConfigEditorOpen.value).toBe(false);
  });

  it("toggles git toolbar config editor", () => {
    const cm = createConfigManagement();
    cm.openGitToolbarConfigEditor();
    expect(cm.isGitToolbarConfigEditorOpen.value).toBe(true);
    cm.closeGitToolbarConfigEditor();
    expect(cm.isGitToolbarConfigEditorOpen.value).toBe(false);
  });

  it("toggles prompt suffix config editor", () => {
    const cm = createConfigManagement();
    cm.openPromptSuffixConfigEditor();
    expect(cm.isPromptSuffixConfigEditorOpen.value).toBe(true);
    cm.closePromptSuffixConfigEditor();
    expect(cm.isPromptSuffixConfigEditorOpen.value).toBe(false);
  });

  it("toggles project settings editor", () => {
    const cm = createConfigManagement();
    cm.openProjectSettingsEditor();
    expect(cm.isProjectSettingsEditorOpen.value).toBe(true);
    cm.closeProjectSettingsEditor();
    expect(cm.isProjectSettingsEditorOpen.value).toBe(false);
  });

  it("toggles secrets editor", () => {
    const cm = createConfigManagement();
    cm.openSecretsEditor();
    expect(cm.isSecretsEditorOpen.value).toBe(true);
    cm.closeSecretsEditor();
    expect(cm.isSecretsEditorOpen.value).toBe(false);
  });
});

describe("handlePromptSuffixToggle", () => {
  it("cycles off → once → always → off", () => {
    const cm = createConfigManagement();
    cm.promptSuffixConfig.value = {
      items: [{ label: "Test", value: "v", mode: "off" }]
    };

    cm.handlePromptSuffixToggle(0);
    expect(cm.promptSuffixConfig.value.items[0].mode).toBe("once");

    cm.handlePromptSuffixToggle(0);
    expect(cm.promptSuffixConfig.value.items[0].mode).toBe("always");

    cm.handlePromptSuffixToggle(0);
    expect(cm.promptSuffixConfig.value.items[0].mode).toBe("off");
  });

  it("only changes the item at the specified index", () => {
    const cm = createConfigManagement();
    cm.promptSuffixConfig.value = {
      items: [
        { label: "A", value: "a", mode: "off" },
        { label: "B", value: "b", mode: "always" }
      ]
    };

    cm.handlePromptSuffixToggle(0);
    expect(cm.promptSuffixConfig.value.items[0].mode).toBe("once");
    expect(cm.promptSuffixConfig.value.items[1].mode).toBe("always");
  });

  it("does nothing for out-of-range index", () => {
    const cm = createConfigManagement();
    cm.promptSuffixConfig.value = {
      items: [{ label: "A", value: "a", mode: "off" }]
    };

    cm.handlePromptSuffixToggle(-1);
    cm.handlePromptSuffixToggle(5);
    expect(cm.promptSuffixConfig.value.items[0].mode).toBe("off");
  });
});

describe("canReloadPromptSuffixConfig", () => {
  it("returns true initially (no edits, no persists)", () => {
    const cm = createConfigManagement();
    expect(cm.canReloadPromptSuffixConfig()).toBe(true);
  });

  it("returns false after applyPromptSuffixConfig (edit version ahead)", () => {
    const cm = createConfigManagement();
    cm.applyPromptSuffixConfig({ items: [] });
    expect(cm.canReloadPromptSuffixConfig()).toBe(false);
  });
});

describe("resetConfigPersistState", () => {
  it("resets versions so canReloadPromptSuffixConfig returns true again", () => {
    const cm = createConfigManagement();
    cm.applyPromptSuffixConfig({ items: [] });
    expect(cm.canReloadPromptSuffixConfig()).toBe(false);
    cm.resetConfigPersistState();
    expect(cm.canReloadPromptSuffixConfig()).toBe(true);
  });
});
