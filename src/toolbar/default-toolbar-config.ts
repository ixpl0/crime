import { type ToolbarConfig } from "../types/toolbar";

export const defaultToolbarConfig: ToolbarConfig = {
  version: 1,
  elements: [
    {
      type: "dropdown",
      id: "agents",
      label: "Агенты",
      items: [
        {
          id: "claude-code",
          label: "Claude Code",
          shortcut: "alt+1",
          action: { type: "run-command", command: "claude" },
        },
        {
          id: "codex-cli",
          label: "Codex CLI",
          shortcut: "alt+2",
          action: { type: "run-command", command: "codex" },
        },
        {
          id: "aider",
          label: "Aider",
          shortcut: "alt+3",
          action: { type: "run-command", command: "aider" },
        },
      ],
    },
    {
      type: "button",
      id: "ctrl-c",
      label: "Ctrl+C",
      shortcut: "ctrl+c",
      action: { type: "send-input", input: "\u0003" },
    },
    {
      type: "button",
      id: "resume",
      label: "/resume",
      action: { type: "run-command", command: "/resume" },
    },
    {
      type: "button",
      id: "new",
      label: "/new",
      action: { type: "run-command", command: "/new" },
    },
    {
      type: "button",
      id: "commit-push",
      label: "Коммит пуш",
      action: { type: "run-command", command: "коммит пуш" },
    },
  ],
};
