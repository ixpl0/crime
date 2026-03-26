import { loadJsonProjectSetting, saveJsonProjectSetting } from "../settings/settings-storage-helpers";
import { type ToolbarConfig } from "../types/toolbar";
import defaultGitToolbarJson from "../defaults/git-toolbar.json";
import { parseToolbarConfig, serializeToolbarConfig } from "./toolbar-storage";

export const GIT_TOOLBAR_CONFIG_FILENAME = "git-toolbar.json";

const parsedDefaultGitToolbarConfig = parseToolbarConfig(defaultGitToolbarJson);
if (!parsedDefaultGitToolbarConfig) {
  throw new Error("Default git toolbar config is invalid");
}
export const defaultGitToolbarConfig: ToolbarConfig = parsedDefaultGitToolbarConfig;

export const loadGitToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  return loadJsonProjectSetting(
    projectPath,
    GIT_TOOLBAR_CONFIG_FILENAME,
    parseToolbarConfig,
    defaultGitToolbarConfig,
    {
      settingLabel: "git toolbar config",
      persistFallbackValue: defaultGitToolbarJson
    }
  );
};

export const saveGitToolbarConfig = async (
  projectPath: string,
  config: ToolbarConfig
): Promise<void> => {
  await saveJsonProjectSetting(
    projectPath,
    GIT_TOOLBAR_CONFIG_FILENAME,
    serializeToolbarConfig(config),
    "git toolbar config"
  );
};
