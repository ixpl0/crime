const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appMeta", {
  framework: "Electron + Vue + Tailwind + daisyUI",
  runtime: "Bun"
});

contextBridge.exposeInMainWorld("projectApi", {
  openFolder: () => ipcRenderer.invoke("project:open-folder")
});
