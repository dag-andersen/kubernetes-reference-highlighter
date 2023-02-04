import {
  window,
  DecorationOptions,
  Range,
  TextEditor,
  MarkdownString,
} from "vscode";
import { Highlight } from "./types";

export function getDecoration(
  message: string,
  posIndex: number
): DecorationOptions {
  const textEditor = window.activeTextEditor!;

  const matchPosition = textEditor.document.positionAt(posIndex);
  const endPosition = textEditor.document.lineAt(matchPosition).range.end;

  let decoration: DecorationOptions = {
    range: new Range(endPosition, endPosition),
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
  highlights: Highlight[]
): DecorationOptions[] {
  return highlights.map((h) => {
    return getDecoration(h.message, h.start);
  });
}