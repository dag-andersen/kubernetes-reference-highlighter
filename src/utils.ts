import { format } from "util";
import * as vscode from "vscode";
import {
  DecorationOptions,
  MarkdownString,
  Position,
  window,
} from "vscode";

let log: string[] = [];

let deco = window.createTextEditorDecorationType({
  after: {
    margin: "2em",
  },
});

export function logTextReset() {
  log.length = 0;
}

export function logText(input: any, line: number = 0) {
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  log.push(format(input));

  let end = editor.document.lineAt(new Position(line, 0)).range.end;

  let message = "";

  log.forEach((element, index) => {
    if (index > 0) {
      message += "\\\n";
    }
    message += element;
  });

  let markdown = new MarkdownString(message);
  markdown.isTrusted = true;

  let decoration: DecorationOptions = {
    range: new vscode.Range(end, end),
    hoverMessage: markdown,
    renderOptions: {
      after: {
        contentText: "🐞",
      },
    },
  };

  editor.setDecorations(deco, [decoration]);
}
