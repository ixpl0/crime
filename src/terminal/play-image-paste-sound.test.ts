// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../composables/use-sound-settings", () => ({
  getIsSoundEnabled: vi.fn()
}));

const { getIsSoundEnabled } = vi.mocked(await import("../composables/use-sound-settings"));
const { playImagePasteSound } = await import("./play-image-paste-sound");

// Заглушка Web Audio: реальная реализация в happy-dom отсутствует.
// Нам достаточно зафиксировать сам факт создания AudioContext.
const audioContextConstructor = vi.fn();

beforeEach(() => {
  audioContextConstructor.mockClear();
  getIsSoundEnabled.mockReset();
  vi.stubGlobal("AudioContext", audioContextConstructor);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playImagePasteSound", () => {
  it("не создаёт AudioContext, когда звук выключен", () => {
    getIsSoundEnabled.mockReturnValue(false);
    playImagePasteSound();
    expect(audioContextConstructor).not.toHaveBeenCalled();
  });

  it("создаёт AudioContext, когда звук включён", () => {
    getIsSoundEnabled.mockReturnValue(true);
    playImagePasteSound();
    expect(audioContextConstructor).toHaveBeenCalledTimes(1);
  });
});
