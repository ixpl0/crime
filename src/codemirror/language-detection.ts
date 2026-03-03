import type { Extension } from "@codemirror/state";

const extensionToLanguage: Partial<Record<string, () => Promise<Extension>>> = {
  js: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  mjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  cjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  ts: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  mts: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  cts: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  tsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true, typescript: true })),
  vue: () => import("@codemirror/lang-html").then((m) => m.html()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  htm: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  md: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  py: () => import("@codemirror/lang-python").then((m) => m.python()),
};

const getFileExtension = (path: string): string => {
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex === -1) { return ""; }
  return path.slice(dotIndex + 1).toLowerCase();
};

export const loadLanguageExtension = async (filePath: string): Promise<Extension[]> => {
  const extension = getFileExtension(filePath);
  const loader = extensionToLanguage[extension];
  if (!loader) { return []; }
  try {
    const result = await loader();
    return [result];
  } catch {
    return [];
  }
};
