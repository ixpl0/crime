const IPC_CHANNELS = Object.freeze({
  projectOpenFolder: "project:open-folder",
  settingsRead: "settings:read",
  settingsWrite: "settings:write",
  settingsWatch: "settings:watch",
  settingsUnwatch: "settings:unwatch",
  settingsFileChanged: "settings:file-changed",
  terminalStart: "terminal:start",
  terminalInput: "terminal:input",
  terminalResize: "terminal:resize",
  terminalStop: "terminal:stop",
  terminalData: "terminal:data",
  terminalExit: "terminal:exit",
  clipboardWriteText: "clipboard:write-text",
  filesystemReadDirectory: "filesystem:read-directory",
  globalQuickKey: "global:quick-key",
  shellOpenExternal: "shell:open-external",
  windowFlashFrame: "window:flash-frame",
  projectOpenInNewWindow: "project:open-in-new-window",
  projectCreateFolder: "project:create-folder",
  logWrite: "log:write"
});

module.exports = {
  IPC_CHANNELS
};
