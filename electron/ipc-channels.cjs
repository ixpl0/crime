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
  filesystemReadFile: "filesystem:read-file",
  gitStatus: "git:status",
  gitFileDiff: "git:file-diff",
  globalQuickKey: "global:quick-key"
});

module.exports = {
  IPC_CHANNELS
};
