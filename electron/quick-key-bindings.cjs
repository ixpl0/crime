const PRIMARY_ACCELERATOR_MODIFIER = process.platform === "darwin" ? "Cmd" : "Ctrl";
const withPrimaryModifier = (chord) => `${PRIMARY_ACCELERATOR_MODIFIER}+${chord}`;

const quickKeyBindings = Object.freeze([
  {
    id: "quick-1",
    accelerator: withPrimaryModifier("Alt+Shift+1"),
    input: "1",
    label: "1",
    icon: null,
    mode: "raw",
    gridIndex: 1
  },
  {
    id: "quick-2",
    accelerator: withPrimaryModifier("Alt+Shift+2"),
    input: "2",
    label: "2",
    icon: null,
    mode: "raw",
    gridIndex: 2
  },
  {
    id: "quick-3",
    accelerator: withPrimaryModifier("Alt+Shift+3"),
    input: "3",
    label: "3",
    icon: null,
    mode: "raw",
    gridIndex: 3
  },
  {
    id: "quick-4",
    accelerator: withPrimaryModifier("Alt+Shift+4"),
    input: "4",
    label: "4",
    icon: null,
    mode: "raw",
    gridIndex: 4
  },
  {
    id: "quick-yes",
    accelerator: withPrimaryModifier("Alt+Shift+Y"),
    input: "\u0434\u0430",
    label: "\u0414\u0430",
    icon: null,
    mode: "text",
    gridIndex: 5
  },
  {
    id: "quick-up",
    accelerator: withPrimaryModifier("Alt+Shift+Up"),
    input: "\x1b[A",
    label: "Up",
    icon: "arrow-up",
    mode: "raw",
    gridIndex: 6
  },
  {
    id: "quick-no",
    accelerator: withPrimaryModifier("Alt+Shift+N"),
    input: "\u043d\u0435\u0442",
    label: "\u041d\u0435\u0442",
    icon: null,
    mode: "text",
    gridIndex: 7
  },
  {
    id: "quick-esc",
    accelerator: withPrimaryModifier("Alt+Shift+E"),
    input: "\x1b",
    label: "Esc",
    icon: null,
    mode: "raw",
    gridIndex: 8
  },
  {
    id: "quick-left",
    accelerator: withPrimaryModifier("Alt+Shift+Left"),
    input: "\x1b[D",
    label: "Left",
    icon: "arrow-left",
    mode: "raw",
    gridIndex: 9
  },
  {
    id: "quick-down",
    accelerator: withPrimaryModifier("Alt+Shift+Down"),
    input: "\x1b[B",
    label: "Down",
    icon: "arrow-down",
    mode: "raw",
    gridIndex: 10
  },
  {
    id: "quick-right",
    accelerator: withPrimaryModifier("Alt+Shift+Right"),
    input: "\x1b[C",
    label: "Right",
    icon: "arrow-right",
    mode: "raw",
    gridIndex: 11
  },
  {
    id: "quick-enter",
    accelerator: withPrimaryModifier("Alt+Shift+Enter"),
    input: "\r",
    label: "Enter",
    icon: "enter",
    mode: "raw",
    gridIndex: 12
  }
]);

module.exports = {
  quickKeyBindings
};
