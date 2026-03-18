import { loadJsonProjectSetting, saveJsonProjectSetting } from "../settings/settings-storage-helpers";
import { type ToolbarConfig } from "../types/toolbar";
import defaultTerminalToolbarJson from "../defaults/terminal-toolbar.json";
import { parseToolbarConfig, serializeToolbarConfig } from "./toolbar-storage";

export const TERMINAL_TOOLBAR_CONFIG_FILENAME = "terminal-toolbar.json";

const parsedDefaultTerminalToolbarConfig = parseToolbarConfig(defaultTerminalToolbarJson);
if (!parsedDefaultTerminalToolbarConfig) {
  throw new Error("Default terminal toolbar config is invalid");
}
export const defaultTerminalToolbarConfig: ToolbarConfig = parsedDefaultTerminalToolbarConfig;

export const loadTerminalToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  return loadJsonProjectSetting(
    projectPath,
    TERMINAL_TOOLBAR_CONFIG_FILENAME,
    parseToolbarConfig,
    defaultTerminalToolbarConfig,
    {
      settingLabel: "terminal toolbar config",
      persistFallbackValue: defaultTerminalToolbarJson
    }
  );
};

export const saveTerminalToolbarConfig = async (
  projectPath: string,
  config: ToolbarConfig
): Promise<void> => {
  await saveJsonProjectSetting(
    projectPath,
    TERMINAL_TOOLBAR_CONFIG_FILENAME,
    serializeToolbarConfig(config),
    "terminal toolbar config"
  );
};
