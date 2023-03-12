import { format } from "util";
import * as vscode from "vscode";
import { DecorationOptions, MarkdownString, Position, window } from "vscode";

const log: string[] = [];

const deco = window.createTextEditorDecorationType({
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

  const end = editor.document.lineAt(new Position(line, 0)).range.end;

  const message = log.join("\\\n");

  const markdown = new MarkdownString(message);
  markdown.isTrusted = true;

  const decoration: DecorationOptions = {
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

export function hashCode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString();
}
