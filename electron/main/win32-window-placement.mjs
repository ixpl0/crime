import koffi from "koffi";

const POINT = koffi.struct("POINT", {
  x: "long",
  y: "long"
});

const RECT = koffi.struct("RECT", {
  left: "long",
  top: "long",
  right: "long",
  bottom: "long"
});

const WINDOWPLACEMENT = koffi.struct("WINDOWPLACEMENT", {
  length: "uint",
  flags: "uint",
  showCmd: "uint",
  ptMinPosition: POINT,
  ptMaxPosition: POINT,
  rcNormalPosition: RECT
});

const user32 = koffi.load("user32.dll");

const GetWindowPlacement = user32.func(
  "bool __stdcall GetWindowPlacement(int hWnd, _Inout_ WINDOWPLACEMENT *lpwndpl)"
);

const SetWindowPlacement = user32.func(
  "bool __stdcall SetWindowPlacement(int hWnd, WINDOWPLACEMENT *lpwndpl)"
);

const readHwnd = (win) => win.getNativeWindowHandle().readInt32LE(0);

const PLACEMENT_LENGTH = koffi.sizeof(WINDOWPLACEMENT);

const emptyPlacement = () => ({
  length: PLACEMENT_LENGTH,
  flags: 0,
  showCmd: 0,
  ptMinPosition: { x: 0, y: 0 },
  ptMaxPosition: { x: 0, y: 0 },
  rcNormalPosition: { left: 0, top: 0, right: 0, bottom: 0 }
});

export const getWindowPlacement = (win) => {
  const placement = emptyPlacement();
  const success = GetWindowPlacement(readHwnd(win), placement);
  return success ? placement : null;
};

export const setWindowPlacement = (win, placement) =>
  SetWindowPlacement(readHwnd(win), { ...placement, length: PLACEMENT_LENGTH });
