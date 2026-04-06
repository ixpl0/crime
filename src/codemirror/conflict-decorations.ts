import { EditorView, Decoration, type DecorationSet, WidgetType } from "@codemirror/view";
import { StateField, RangeSetBuilder } from "@codemirror/state";

export interface ConflictRegion {
  oursStartLine: number;
  separatorLine: number;
  theirsEndLine: number;
}

export const parseConflictRegions = (doc: string): readonly ConflictRegion[] => {
  const lines = doc.split("\n");
  const regions: ConflictRegion[] = [];
  let oursStartLine: number | null = null;
  let separatorLine: number | null = null;

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index]?.trimStart() ?? "";
    if (trimmed.startsWith("<<<<<<<")) {
      oursStartLine = index;
      separatorLine = null;
    } else if (trimmed.startsWith("=======") && oursStartLine !== null) {
      separatorLine = index;
    } else if (trimmed.startsWith(">>>>>>>") && oursStartLine !== null && separatorLine !== null) {
      regions.push({
        oursStartLine,
        separatorLine,
        theirsEndLine: index
      });
      oursStartLine = null;
      separatorLine = null;
    }
  }

  return regions;
};

const oursLineDecoration = Decoration.line({ class: "cm-conflict-ours" });
const theirsLineDecoration = Decoration.line({ class: "cm-conflict-theirs" });
const markerLineDecoration = Decoration.line({ class: "cm-conflict-marker" });

type ConflictAction = "accept-current" | "accept-incoming" | "accept-both";

class ConflictButtonWidget extends WidgetType {
  private readonly regionIndex: number;

  constructor(regionIndex: number) {
    super();
    this.regionIndex = regionIndex;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-conflict-actions";

    const createButton = (label: string, action: ConflictAction) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.className = `cm-conflict-btn cm-conflict-btn-${action}`;
      button.type = "button";
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        view.dom.dispatchEvent(new CustomEvent("conflict-action", {
          bubbles: true,
          detail: { action, regionIndex: this.regionIndex }
        }));
      });
      return button;
    };

    wrapper.appendChild(createButton("Принять текущую", "accept-current"));
    wrapper.appendChild(createButton("Принять входящую", "accept-incoming"));
    wrapper.appendChild(createButton("Принять обе", "accept-both"));

    return wrapper;
  }

  override eq(other: WidgetType): boolean {
    return other instanceof ConflictButtonWidget && other.regionIndex === this.regionIndex;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

const buildLineOffsets = (doc: string): readonly number[] => {
  const lines = doc.split("\n");
  let charOffset = 0;
  const offsets: number[] = [];
  for (const line of lines) {
    offsets.push(charOffset);
    charOffset += line.length + 1;
  }
  return offsets;
};

const addRegionDecorations = (
  builder: RangeSetBuilder<Decoration>,
  region: ConflictRegion,
  regionIndex: number,
  lineOffsets: readonly number[]
) => {
  const widgetPos = lineOffsets[region.oursStartLine] ?? 0;
  builder.add(widgetPos, widgetPos, Decoration.widget({
    widget: new ConflictButtonWidget(regionIndex),
    block: true
  }));
  builder.add(widgetPos, widgetPos, markerLineDecoration);

  for (let line = region.oursStartLine + 1; line < region.separatorLine; line++) {
    const pos = lineOffsets[line] ?? 0;
    builder.add(pos, pos, oursLineDecoration);
  }

  const sepPos = lineOffsets[region.separatorLine] ?? 0;
  builder.add(sepPos, sepPos, markerLineDecoration);

  for (let line = region.separatorLine + 1; line < region.theirsEndLine; line++) {
    const pos = lineOffsets[line] ?? 0;
    builder.add(pos, pos, theirsLineDecoration);
  }

  const endPos = lineOffsets[region.theirsEndLine] ?? 0;
  builder.add(endPos, endPos, markerLineDecoration);
};

const buildConflictDecorations = (doc: string): DecorationSet => {
  const regions = parseConflictRegions(doc);
  if (regions.length === 0) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const lineOffsets = buildLineOffsets(doc);

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    addRegionDecorations(builder, regions[regionIndex], regionIndex, lineOffsets);
  }

  return builder.finish();
};

export const conflictDecorationsField = StateField.define<DecorationSet>({
  create: (state) => buildConflictDecorations(state.doc.toString()),
  update: (decorations, transaction) => {
    if (transaction.docChanged) {
      return buildConflictDecorations(transaction.state.doc.toString());
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field)
});

export const hasConflictMarkers = (content: string): boolean =>
  content.includes("<<<<<<<") && content.includes("=======") && content.includes(">>>>>>>");

export const conflictTheme = EditorView.theme({
  ".cm-conflict-ours": { backgroundColor: "rgba(34, 197, 94, 0.12)" },
  ".cm-conflict-theirs": { backgroundColor: "rgba(96, 165, 250, 0.12)" },
  ".cm-conflict-marker": {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    fontStyle: "italic",
    opacity: "0.6"
  },
  ".cm-conflict-actions": {
    display: "flex",
    gap: "8px",
    padding: "4px 8px",
    fontSize: "11px",
    lineHeight: "1"
  },
  ".cm-conflict-btn": {
    cursor: "pointer",
    border: "none",
    background: "none",
    padding: "2px 6px",
    borderRadius: "3px",
    fontFamily: "inherit",
    fontSize: "11px"
  },
  ".cm-conflict-btn-accept-current": {
    color: "rgb(74, 222, 128)",
    "&:hover": { backgroundColor: "rgba(34, 197, 94, 0.2)" }
  },
  ".cm-conflict-btn-accept-incoming": {
    color: "rgb(96, 165, 250)",
    "&:hover": { backgroundColor: "rgba(96, 165, 250, 0.2)" }
  },
  ".cm-conflict-btn-accept-both": {
    color: "rgb(250, 204, 21)",
    "&:hover": { backgroundColor: "rgba(250, 204, 21, 0.2)" }
  }
});
