import {
  window,
  DecorationOptions,
  Range,
  TextEditor,
  MarkdownString,
  Position,
  TextDocument,
} from "vscode";
import { Highlight } from "./types";

export type Deco = { ln: number; position: Position; message: string };

export function getDecoration(
  message: string,
  posIndex: Position
): DecorationOptions {
  let decoration: DecorationOptions = {
    range: new Range(posIndex, posIndex),
    hoverMessage: new MarkdownString(message),
    renderOptions: {
      after: {
        contentText: "✅",
      },
    },
  };
  return decoration;
}

let deco = window.createTextEditorDecorationType({
  after: {
    margin: "2em",
  },
});

export function decorate(editor: TextEditor, decorations: DecorationOptions[]) {
  editor.setDecorations(deco, decorations);
}

export function highlightsToDecorations(
  doc: TextDocument,
  highlights: Highlight[]
): DecorationOptions[] {
  let decorations = highlights.map((highlight) => {
    return {
      position: doc.lineAt(doc.positionAt(highlight.start)).range.end,
      highlight: highlight,
    };
  });

  const grouped: Deco[] = [];
  decorations
    .sort((a, b) => b.position.line - a.position.line)
    .forEach((h, index) => {
      const previousLineNumber = decorations[index - 1]?.position.line;
      const currentLineNumber = h.position.line;
      if (previousLineNumber === currentLineNumber) {
        grouped[grouped.length - 1].message =
          grouped[grouped.length - 1].message +
          "\n" +
          h.highlight.message;
      } else {
        grouped.push({
          ln: h.position.line,
          position: h.position,
          message: h.highlight.message,
        });
      }
    });

  return grouped.map((h) => {
    return getDecoration(h.message, h.position);
  });
}
