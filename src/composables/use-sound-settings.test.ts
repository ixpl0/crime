// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "crime-sound-enabled";

beforeEach(() => {
  localStorage.clear();
});

// Модуль читает localStorage один раз при импорте, поэтому для проверки
// инициализации сбрасываем модульный кэш и импортируем заново.
const importModule = async () => {
  vi.resetModules();
  return import("./use-sound-settings");
};

describe("useSoundSettings", () => {
  it("включён по умолчанию, когда в localStorage ничего нет", async () => {
    const { useSoundSettings } = await importModule();
    expect(useSoundSettings().isSoundEnabled.value).toBe(true);
  });

  it("читает выключенное состояние из localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, "false");
    const { useSoundSettings } = await importModule();
    expect(useSoundSettings().isSoundEnabled.value).toBe(false);
  });

  it("любое значение кроме \"false\" трактует как включённое", async () => {
    localStorage.setItem(STORAGE_KEY, "true");
    const { useSoundSettings } = await importModule();
    expect(useSoundSettings().isSoundEnabled.value).toBe(true);
  });

  it("setSoundEnabled обновляет ref и сохраняет в localStorage", async () => {
    const { useSoundSettings } = await importModule();
    const { isSoundEnabled, setSoundEnabled } = useSoundSettings();

    setSoundEnabled(false);
    expect(isSoundEnabled.value).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");

    setSoundEnabled(true);
    expect(isSoundEnabled.value).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("toggleSound переключает значение и сохраняет его", async () => {
    const { useSoundSettings } = await importModule();
    const { isSoundEnabled, toggleSound } = useSoundSettings();

    expect(isSoundEnabled.value).toBe(true);

    toggleSound();
    expect(isSoundEnabled.value).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");

    toggleSound();
    expect(isSoundEnabled.value).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("getIsSoundEnabled отражает текущее значение ref", async () => {
    const { useSoundSettings, getIsSoundEnabled } = await importModule();
    const { setSoundEnabled } = useSoundSettings();

    expect(getIsSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(getIsSoundEnabled()).toBe(false);
  });

  it("общий ref: разные вызовы useSoundSettings разделяют состояние", async () => {
    const { useSoundSettings } = await importModule();
    const first = useSoundSettings();
    const second = useSoundSettings();

    first.setSoundEnabled(false);
    expect(second.isSoundEnabled.value).toBe(false);
  });
});
