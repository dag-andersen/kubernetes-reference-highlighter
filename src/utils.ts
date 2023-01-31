import { format } from "util";
import * as vscode from "vscode";

// log message
const diagnosticCollectionTest = vscode.languages.createDiagnosticCollection(
  "kubernetes-reference-highlighter-test"
);

export function logText(a: any) {
  diagnosticCollectionTest.clear();
  const current = vscode.window.activeTextEditor?.document;
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 0),
    format(a),
    vscode.DiagnosticSeverity.Information
  );
  diagnosticCollectionTest.set(current!.uri, [diagnostic]);
}
