import * as vscode from "vscode";
import {
  DecorationOptions,
  MarkdownString,
  Position,
  Range,
  window,
} from "vscode";

let log: string[] = [];

let deco = window.createTextEditorDecorationType({
  after: {
    margin: "2em",
  },
});

export function logTextTextReset() {
  log.length = 0;
}

export function logTextText(text: string, line: number = 0) {
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  log.push(text);

  let end = editor.document.lineAt(new Position(line, 0)).range.end;

  let message = "";

  log.forEach((element, index) => {
    if (index > 0) {
      message += "\\\n";
    }
    message += element;
  });

  let decoration: DecorationOptions = {
    range: new vscode.Range(end, end),
    hoverMessage: new MarkdownString(message),
    renderOptions: {
      after: {
        contentText: "🐞",
      },
    },
  };

  editor.setDecorations(deco, [decoration]);
}
