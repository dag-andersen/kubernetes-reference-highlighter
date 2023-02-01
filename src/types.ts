export type FromWhere = "cluster" | Local;
import * as vscode from "vscode";

export type Local = { place: "workspace" | "kustomize" | "helm"; path: string };

export type Highlight = {
  start: number;
  end: number;
  message: string;
  severity?: vscode.DiagnosticSeverity;
  importance?: number;
};

// define basic type
export type K8sResource = {
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
  spec?: any;
  data?: any;
  where?: FromWhere;
};
