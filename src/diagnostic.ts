import * as vscode from "vscode";

export function createDiagnostic(
  start: number,
  end: number,
  message: string,
  level: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Information
): vscode.Diagnostic {
  const textEditor = vscode.window.activeTextEditor!;
  const s = textEditor.document.positionAt(start);
  const e = textEditor.document.positionAt(end);
  return new vscode.Diagnostic(new vscode.Range(s, e), message, level);
}
