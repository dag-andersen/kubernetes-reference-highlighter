import { format } from "util";
import * as vscode from "vscode";

// log message
const diagnosticCollectionTest = vscode.languages.createDiagnosticCollection(
  "kubernetes-reference-highlighter-test"
);

const diagnostics: vscode.Diagnostic[] = [];

export function logRest() {
  diagnostics.length = 0;
}

export function logText(a: any, b = 0) {
  const current = vscode.window.activeTextEditor?.document;
  diagnostics.push(
    new vscode.Diagnostic(
      new vscode.Range(b, 0, b, 0),
      format(a),
      vscode.DiagnosticSeverity.Information
    )
  );
  diagnosticCollectionTest.set(current!.uri, diagnostics);
}
