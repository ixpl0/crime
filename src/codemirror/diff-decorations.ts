import { EditorView, Decoration, type DecorationSet, GutterMarker, gutter } from "@codemirror/view";
import { StateField, StateEffect, RangeSet, RangeSetBuilder } from "@codemirror/state";

const addedLineDecoration = Decoration.line({ class: "cm-diff-added" });
const removedLineDecoration = Decoration.line({ class: "cm-diff-removed" });

export const createDiffLineDecorations = (lines: readonly GitDiffLine[]): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();
  let position = 0;
  for (const line of lines) {
    if (line.type === "added") {
      builder.add(position, position, addedLineDecoration);
    } else if (line.type === "removed") {
      builder.add(position, position, removedLineDecoration);
    }
    position += line.text.length + 1;
  }
  return builder.finish();
};

class DiffPrefixMarker extends GutterMarker {
  readonly prefix: string;
  readonly className: string;

  constructor(prefix: string, className: string) {
    super();
    this.prefix = prefix;
    this.className = className;
  }

  override toDOM(): Text {
    const textNode = document.createTextNode(this.prefix);
    return textNode;
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof DiffPrefixMarker && other.prefix === this.prefix;
  }
}

const addedMarker = new DiffPrefixMarker("+", "cm-diff-prefix-added");
const removedMarker = new DiffPrefixMarker("-", "cm-diff-prefix-removed");

class LineNumberMarker extends GutterMarker {
  readonly text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  override toDOM(): Text {
    return document.createTextNode(this.text);
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof LineNumberMarker && other.text === this.text;
  }
}

const emptyMarker = new LineNumberMarker(" ");

const buildLineNumberMap = (lines: readonly GitDiffLine[]): ReadonlyMap<number, GutterMarker> => {
  const map = new Map<number, GutterMarker>();
  let fileLineNumber = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] as GitDiffLine | undefined;
    if (line?.type === "removed") {
      map.set(index, emptyMarker);
    } else {
      fileLineNumber++;
      map.set(index, new LineNumberMarker(String(fileLineNumber)));
    }
  }
  return map;
};

export const createDiffLineNumbers = (lines: readonly GitDiffLine[]) => {
  const markerMap = buildLineNumberMap(lines);
  return gutter({
    class: "cm-lineNumbers",
    lineMarker: (view, line) => {
      const lineIndex = view.state.doc.lineAt(line.from).number - 1;
      return markerMap.get(lineIndex) ?? null;
    },
  });
};

export const createDiffPrefixGutter = (lines: readonly GitDiffLine[]) =>
  gutter({
    class: "cm-diff-prefix-gutter",
    lineMarker: (_view, line) => {
      const lineIndex = _view.state.doc.lineAt(line.from).number - 1;
      const diffLine = lines[lineIndex] as GitDiffLine | undefined;
      if (!diffLine) { return null; }
      if (diffLine.type === "added") { return addedMarker; }
      if (diffLine.type === "removed") { return removedMarker; }
      return null;
    },
  });

export const setTargetLineEffect = StateEffect.define<number | null>();

export const targetLineHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setTargetLineEffect)) {
        if (effect.value === null) { return Decoration.none; }
        const lineNumber = effect.value;
        if (lineNumber < 1 || lineNumber > transaction.state.doc.lines) { return Decoration.none; }
        const line = transaction.state.doc.line(lineNumber);
        return RangeSet.of([Decoration.line({ class: "cm-target-line-highlight" }).range(line.from)]);
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const diffViewerTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "monospace" },
  ".cm-content": { padding: "4px 0" },
  ".cm-diff-added": { backgroundColor: "rgba(34, 197, 94, 0.1)" },
  ".cm-diff-removed": { backgroundColor: "rgba(239, 68, 68, 0.1)" },
  ".cm-target-line-highlight": { backgroundColor: "rgba(250, 204, 21, 0.25)", outline: "1px solid rgba(250, 204, 21, 0.4)" },
  ".cm-diff-prefix-gutter": { width: "16px", textAlign: "center" },
  ".cm-diff-prefix-gutter .cm-gutterElement": { color: "rgba(255, 255, 255, 0.5)", padding: "0 2px", display: "flex", alignItems: "center", justifyContent: "center" },
});
