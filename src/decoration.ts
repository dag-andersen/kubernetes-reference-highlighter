import {
  window,
  DecorationOptions,
  Range,
  TextEditor,
  MarkdownString,
  Position,
  TextDocument,
} from "vscode";
import { generateMessage } from "./utils";
import { Highlight, HighLightType } from "./types";

export function getDecoration(
  message: string,
  icon: HighLightType,
  posIndex: Position
): DecorationOptions {
  let i = "";
  switch (icon) {
    case "success":
      i = "✅";
      break;
    case "error":
      i = "❌";
      break;
    case "hint":
      i = "🤷‍♂️";
      break;
    case "reference":
      i = "🔗";
      break;
  }

  let decoration: DecorationOptions = {
    range: new Range(posIndex, posIndex),
    hoverMessage: new MarkdownString(message),
    renderOptions: {
      after: {
        contentText: i,
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

type Deco = {
  ln: number;
  position: Position;
  message: string;
  icon: HighLightType;
};

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
          grouped[grouped.length - 1].message + "\n" + h.highlight.message;
      } else {
        const message =
          typeof h.highlight.message !== "string"
            ? generateMessage(h.highlight.message)
            : h.highlight.message;
        grouped.push({
          ln: h.position.line,
          position: h.position,
          message: message,
          icon: h.highlight.type,
        });
      }
    });

  return grouped.map((d) => {
    return getDecoration(d.message, d.icon, d.position);
  });
}
