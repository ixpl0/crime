import { type EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type SearchQuery, getSearchQuery, searchPanelOpen } from "@codemirror/search";

const MAX_COUNT = 10000;

const counterTheme = EditorView.theme({
  ".cm-search-match-counter": {
    fontSize: "11px",
    opacity: "0.6",
    padding: "0 6px",
    whiteSpace: "nowrap",
  },
});

interface MatchInfo {
  current: number;
  total: number;
}

const collectMatchInfo = (state: EditorState, query: SearchQuery): MatchInfo => {
  const selectionFrom = state.selection.main.from;
  const selectionTo = state.selection.main.to;
  const cursor = query.getCursor(state);

  let total = 0;
  let current = 0;
  let result = cursor.next();

  while (!result.done) {
    total += 1;
    if (total >= MAX_COUNT) {
      return { current: 0, total: MAX_COUNT };
    }

    if (result.value.from === selectionFrom && result.value.to === selectionTo) {
      current = total;
    }

    result = cursor.next();
  }

  return { current, total };
};

const getMatchInfo = (update: ViewUpdate): MatchInfo | null => {
  if (!searchPanelOpen(update.state)) {
    return null;
  }

  const query = getSearchQuery(update.state);
  if (!query.valid) {
    return null;
  }

  return collectMatchInfo(update.state, query);
};

const formatMatchInfo = (info: MatchInfo): string => {
  if (info.total >= MAX_COUNT) {
    return `${String(MAX_COUNT)}+`;
  }
  if (info.current > 0) {
    return `${String(info.current)} / ${String(info.total)}`;
  }
  return String(info.total);
};

const findInsertTarget = (view: EditorView): Element | null =>
  view.dom.querySelector(".cm-search br");

const searchMatchCounterPlugin = ViewPlugin.fromClass(
  class {
    counterElement: HTMLElement | null = null;

    update(update: ViewUpdate) {
      const info = getMatchInfo(update);

      if (info === null) {
        this.removeCounter();
        return;
      }

      this.ensureCounter(update.view);
      if (this.counterElement) {
        this.counterElement.textContent = formatMatchInfo(info);
      }
    }

    ensureCounter(view: EditorView) {
      if (this.counterElement?.parentElement) {
        return;
      }

      const target = findInsertTarget(view);
      if (!target) {
        return;
      }

      this.counterElement = document.createElement("span");
      this.counterElement.className = "cm-search-match-counter";
      target.parentElement?.insertBefore(this.counterElement, target);
    }

    removeCounter() {
      if (this.counterElement?.parentElement) {
        this.counterElement.parentElement.removeChild(this.counterElement);
      }
      this.counterElement = null;
    }

    destroy() {
      this.removeCounter();
    }
  }
);

export const searchMatchCounter = [counterTheme, searchMatchCounterPlugin];
