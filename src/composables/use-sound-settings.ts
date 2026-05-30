import { ref } from "vue";

const STORAGE_KEY = "crime-sound-enabled";

const readStoredSoundEnabled = (): boolean => localStorage.getItem(STORAGE_KEY) !== "false";

const isSoundEnabled = ref<boolean>(readStoredSoundEnabled());

export function useSoundSettings() {
  const setSoundEnabled = (enabled: boolean) => {
    isSoundEnabled.value = enabled;
    localStorage.setItem(STORAGE_KEY, String(enabled));
  };

  const toggleSound = () => {
    setSoundEnabled(!isSoundEnabled.value);
  };

  return {
    isSoundEnabled,
    setSoundEnabled,
    toggleSound
  };
}

export const getIsSoundEnabled = (): boolean => isSoundEnabled.value;
