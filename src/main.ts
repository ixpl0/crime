import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

// Prevent Chromium default Ctrl+Wheel zoom — app handles zoom itself
window.addEventListener("wheel", (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
}, { passive: false, capture: true });

const app = createApp(App);
app.mount("#app");

setTimeout(() => {
  const root = document.getElementById("app");
  const rootChildren = root?.children.length ?? 0;
  const styleSheets = document.styleSheets.length;
  const bodyRect = document.body.getBoundingClientRect();
  const mainElement = root?.querySelector("main");
  const mainVisible = mainElement
    ? getComputedStyle(mainElement).display !== "none" && mainElement.offsetHeight > 0
    : false;
  const mainBg = mainElement ? getComputedStyle(mainElement).backgroundColor : "n/a";
  const mainColor = mainElement ? getComputedStyle(mainElement).color : "n/a";
  void window.projectApi.log.write(
    "info",
    "DOM check: #app children=" + String(rootChildren) + ", styleSheets=" + String(styleSheets)
    + ", body=" + String(bodyRect.width) + "x" + String(bodyRect.height)
    + ", mainVisible=" + String(mainVisible) + ", mainBg=" + mainBg + ", mainColor=" + mainColor
  );
}, 2000);
