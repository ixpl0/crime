import { type ToolbarConfig } from "../types/toolbar";

export const defaultToolbarConfig: ToolbarConfig = {
  elements: [
    {
      type: "dropdown",
      label: "\u0410\u0433\u0435\u043d\u0442\u044b",
      items: [
        {
          label: "Claude Code",
          command: "claude",
        },
        {
          label: "Codex CLI",
          command: "codex",
        },
        {
          label: "Aider",
          command: "aider",
        },
      ],
    },
    {
      type: "button",
      label: "Ctrl+C",
      rawInput: "\u0003",
    },
    {
      type: "button",
      label: "/resume",
      command: "/resume",
    },
    {
      type: "button",
      label: "/new",
      command: "/new",
    },
    {
      type: "button",
      label: "\u041a\u043e\u043c\u043c\u0438\u0442 \u043f\u0443\u0448",
      command: "\u043a\u043e\u043c\u043c\u0438\u0442 \u043f\u0443\u0448",
    },
  ],
};
