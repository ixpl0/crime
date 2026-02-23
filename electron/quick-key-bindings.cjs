const quickKeyBindings = Object.freeze([
  {
    id: "quick-1",
    accelerator: "CommandOrControl+Alt+Shift+1",
    input: "1",
    label: "1",
    icon: null,
    gridIndex: 1
  },
  {
    id: "quick-2",
    accelerator: "CommandOrControl+Alt+Shift+2",
    input: "2",
    label: "2",
    icon: null,
    gridIndex: 2
  },
  {
    id: "quick-3",
    accelerator: "CommandOrControl+Alt+Shift+3",
    input: "3",
    label: "3",
    icon: null,
    gridIndex: 3
  },
  {
    id: "quick-4",
    accelerator: "CommandOrControl+Alt+Shift+4",
    input: "4",
    label: "4",
    icon: null,
    gridIndex: 4
  },
  {
    id: "quick-up",
    accelerator: "CommandOrControl+Alt+Shift+Up",
    input: "\x1b[A",
    label: "Up",
    icon: "arrow-up",
    gridIndex: 6
  },
  {
    id: "quick-esc",
    accelerator: "CommandOrControl+Alt+Shift+E",
    input: "\x1b",
    label: "Esc",
    icon: null,
    gridIndex: 8
  },
  {
    id: "quick-left",
    accelerator: "CommandOrControl+Alt+Shift+Left",
    input: "\x1b[D",
    label: "Left",
    icon: "arrow-left",
    gridIndex: 9
  },
  {
    id: "quick-down",
    accelerator: "CommandOrControl+Alt+Shift+Down",
    input: "\x1b[B",
    label: "Down",
    icon: "arrow-down",
    gridIndex: 10
  },
  {
    id: "quick-right",
    accelerator: "CommandOrControl+Alt+Shift+Right",
    input: "\x1b[C",
    label: "Right",
    icon: "arrow-right",
    gridIndex: 11
  },
  {
    id: "quick-enter",
    accelerator: "CommandOrControl+Alt+Shift+Enter",
    input: "\r",
    label: "Enter",
    icon: "enter",
    gridIndex: 12
  }
]);

module.exports = {
  quickKeyBindings
};
