const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appMeta", {
  framework: "Electron + Vue + Tailwind + daisyUI",
  runtime: "Bun"
});

contextBridge.exposeInMainWorld("projectApi", {
  openFolder: () => ipcRenderer.invoke("project:open-folder"),
  settings: {
    read: (projectPath, filename) => ipcRenderer.invoke("settings:read", projectPath, filename),
    write: (projectPath, filename, content) => ipcRenderer.invoke("settings:write", projectPath, filename, content),
    watch: (projectPath, filename) => ipcRenderer.invoke("settings:watch", projectPath, filename),
    unwatch: () => ipcRenderer.invoke("settings:unwatch"),
    onFileChanged: (listener) => {
      const handler = (_event, filename) => listener(filename);
      ipcRenderer.on("settings:file-changed", handler);
      return () => ipcRenderer.removeListener("settings:file-changed", handler);
    }
  },
  terminal: {
    start: (cwd, size) => ipcRenderer.invoke("terminal:start", cwd, size),
    runCommand: (command) => ipcRenderer.invoke("terminal:run-command", command),
    input: (data) => ipcRenderer.invoke("terminal:input", data),
    resize: (size) => ipcRenderer.invoke("terminal:resize", size),
    stop: () => ipcRenderer.invoke("terminal:stop"),
    onData: (listener) => {
      const handler = (_event, data) => listener(data);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },
    onExit: (listener) => {
      const handler = (_event, code) => listener(code);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    }
  },
  filesystem: {
    readDirectory: (dirPath) => ipcRenderer.invoke("filesystem:read-directory", dirPath),
    readFile: (projectPath, filePath) =>
      ipcRenderer.invoke("filesystem:read-file", projectPath, filePath)
  },
  git: {
    getStatus: (projectPath) => ipcRenderer.invoke("git:status", projectPath),
    getFileDiff: (projectPath, filePath) =>
      ipcRenderer.invoke("git:file-diff", projectPath, filePath)
  },
  onGlobalQuickKey: (listener) => {
    const handler = (_event, input) => listener(input);
    ipcRenderer.on("global:quick-key", handler);
    return () => ipcRenderer.removeListener("global:quick-key", handler);
  }
});
