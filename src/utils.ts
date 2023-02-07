import { format } from "util";
import * as vscode from "vscode";
import { FromWhere } from "./types";

// LOGS

//TODO: REPLACE DIAGNOSTICS WITH DECORATIONS
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

// MESSAGES

export type Message =
  | SubItemNotFound
  | ReferenceNotFound
  | ReferenceFound
  | SubItemFound;

export function generateMessage(mg: Message): string {
  if ("type" in mg) {
    return generateFoundMessage(mg);
  } else if ("suggestion" in mg && "subType" in mg) {
    return generateSubItemNotFoundMessage(mg);
  } else if ("suggestion" in mg) {
    return generateNotFoundMessage(mg);
  } else if ("subType" in mg) {
    return generateSubItemFoundMessage(mg);
  }
  return "";
}

type ReferenceFound = {
  type: string;
  name: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateFoundMessage(mg: ReferenceFound): string {
  const { type, name, activeFilePath, fromWhere } = mg;
  let message = `✅ Found ${type}: \`${name}\``;
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message += ` in ${fromWhere}`;
    } else {
      const relativePath = getRelativePath(fromWhere.path, activeFilePath);
      message +=
        fromWhere.place === "workspace"
          ? ` in \`${relativePath}\``
          : ` with ${fromWhere.place} at \`${relativePath}\``;
    }
  }
  return message;
}

type ReferenceNotFound = {
  name: string;
  suggestion: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateNotFoundMessage(mg: ReferenceNotFound): string {
  const { name, activeFilePath, fromWhere, suggestion } = mg;
  let message = `🤷‍♂️ \`${name}\` not found. Did you mean \`${suggestion}\`?`;
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message += ` (found in ${fromWhere})`;
    } else {
      const relativePath = getRelativePath(fromWhere.path, activeFilePath);
      message +=
        fromWhere.place === "workspace"
          ? ` (in \`${relativePath}\`)`
          : ` (with ${fromWhere.place} at \`${relativePath}\`)`;
    }
  }
  return message;
}

type SubItemFound = {
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateSubItemFoundMessage(mg: SubItemFound): string {
  const { subType, mainType, subName, mainName, activeFilePath, fromWhere } = mg;
  let message = `✅ Found ${subType}: \`${subName}\` in ${mainType}: \`${mainName}\``;
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message += ` at ${fromWhere}`;
    } else {
      const relativePath = getRelativePath(fromWhere.path, activeFilePath);
      message +=
        fromWhere.place === "workspace"
          ? ` in \`${relativePath}\``
          : ` with ${fromWhere.place} at \`${relativePath}\``;
    }
  }
  return message;
}

type SubItemNotFound = {
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  suggestion: string;
  activeFilePath: string;
  fromWhere?: FromWhere;
};

function generateSubItemNotFoundMessage(mg: SubItemNotFound): string {
  const { subType, activeFilePath, subName, mainType, fromWhere, suggestion, mainName } = mg;
  let message = `🤷‍♂️ _${subType}_: \`${subName}\` not found in _${mainType}_: \`${mainName}\``;
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message += ` (in ${fromWhere})`;
    } else {
      const relativePath = getRelativePath(fromWhere.path, activeFilePath);
      message +=
        fromWhere.place === "workspace"
          ? ` (in \`${relativePath}\`)`
          : ` (with ${fromWhere.place} at \`${relativePath}\`)`;
    }
  }
  return message + `.\\\nDid you mean \`${suggestion}\`?`;
}

function getRelativePath(path: string, activeFilePath: string): string {
  const p = require("path");
  const fromFilePath = path;
  const relativeFilePathFromRoot = vscode.workspace.asRelativePath(
    fromFilePath || ""
  );
  const activeDirPath: string = p.dirname(activeFilePath || "");
  const relativePathFromActive: string = p.relative(
    activeDirPath || "",
    fromFilePath
  );
  return relativeFilePathFromRoot.length < relativePathFromActive.length
    ? "/" + relativeFilePathFromRoot
    : relativePathFromActive.includes("/")
    ? relativePathFromActive
    : "./" + relativePathFromActive;
}
