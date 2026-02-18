const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("appMeta", {
  framework: "Electron + Vue + Tailwind + daisyUI",
  runtime: "Bun"
});
