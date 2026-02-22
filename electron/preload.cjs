const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appMeta", {
  framework: "Electron + Vue + Tailwind + daisyUI",
  runtime: "Bun"
});

contextBridge.exposeInMainWorld("projectApi", {
  openFolder: () => ipcRenderer.invoke("project:open-folder"),
  settings: {
    read: (projectPath, filename) => ipcRenderer.invoke("settings:read", projectPath, filename),
    write: (projectPath, filename, content) => ipcRenderer.invoke("settings:write", projectPath, filename, content)
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
  }
});
