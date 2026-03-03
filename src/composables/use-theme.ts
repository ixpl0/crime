import { onMounted, ref } from "vue";

type Theme = "light" | "dark" | "cupcake" | "bumblebee" | "emerald" | "corporate" | "synthwave" | "retro" | "cyberpunk" | "valentine" | "halloween" | "garden" | "forest" | "aqua" | "lofi" | "pastel" | "fantasy" | "wireframe" | "black" | "luxury" | "dracula" | "cmyk" | "autumn" | "business" | "acid" | "lemonade" | "night" | "coffee" | "winter" | "dim" | "nord" | "sunset";

const VALID_THEMES: readonly string[] = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate", "synthwave",
  "retro", "cyberpunk", "valentine", "halloween", "garden", "forest", "aqua",
  "lofi", "pastel", "fantasy", "wireframe", "black", "luxury", "dracula",
  "cmyk", "autumn", "business", "acid", "lemonade", "night", "coffee",
  "winter", "dim", "nord", "sunset"
];

const DEFAULT_THEME: Theme = "light";
const STORAGE_KEY = "dream-ide-theme";

const toValidTheme = (value: string | null): Theme =>
  value !== null && VALID_THEMES.includes(value) ? value as Theme : DEFAULT_THEME;

const currentTheme = ref<Theme>(toValidTheme(localStorage.getItem(STORAGE_KEY)));

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
    setTheme(toValidTheme(localStorage.getItem(STORAGE_KEY)));
  });

  return {
    currentTheme,
    setTheme,
    toggleTheme
  };
}
