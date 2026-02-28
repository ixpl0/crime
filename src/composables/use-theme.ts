import { onMounted, ref } from "vue";

type Theme = "light" | "dark" | "cupcake" | "bumblebee" | "emerald" | "corporate" | "synthwave" | "retro" | "cyberpunk" | "valentine" | "halloween" | "garden" | "forest" | "aqua" | "lofi" | "pastel" | "fantasy" | "wireframe" | "black" | "luxury" | "dracula" | "cmyk" | "autumn" | "business" | "acid" | "lemonade" | "night" | "coffee" | "winter" | "dim" | "nord" | "sunset";

const STORAGE_KEY = "dream-ide-theme";

const currentTheme = ref<Theme>((localStorage.getItem(STORAGE_KEY) ?? "light") as Theme);

export function useTheme() {
  const setTheme = (theme: Theme) => {
    currentTheme.value = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  };

  const toggleTheme = () => {
    setTheme(currentTheme.value === "light" ? "dark" : "light");
  };

  onMounted(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    if (storedTheme) {
      setTheme(storedTheme as Theme);
    } else {
      setTheme("light");
    }
  });

  return {
    currentTheme,
    setTheme,
    toggleTheme
  };
}
