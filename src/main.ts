import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

// Prevent Chromium default Ctrl+Wheel zoom — app handles zoom itself
window.addEventListener("wheel", (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
}, { passive: false, capture: true });

createApp(App).mount("#app");
