import { K8sResource } from "./types";
import * as vscode from "vscode";
import { textToK8sResource, createDiagnostic } from "./extension";
import { getAllFileNamesInDirectory } from "./extension";
import { format } from "util";

const kustomizeIsInstalled = isKustomizeInstalled();
const kustomizeCommand = kustomizeIsInstalled
  ? "kustomize build"
  : "kubectl kustomize";

export function getKustomizeResources(): K8sResource[] {
  const kustomizationFiles = getKustomizationPathsInWorkspace();

  const resources = kustomizationFiles.flatMap(kustomizeBuild);

  return resources;
}

function getKustomizationPathsInWorkspace(): string[] {
  const workspaceFolders =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!workspaceFolders) {
    return [];
  }

  const kustomizationFiles = getAllFileNamesInDirectory(
    workspaceFolders
  ).filter(
    (file) =>
      file.endsWith("kustomization.yml") || file.endsWith("kustomization.yaml")
  );

  return kustomizationFiles;
}

function kustomizeBuild(file: string): K8sResource[] {
  const path = file.substring(0, file.lastIndexOf("/"));

  const execSync = require("child_process").execSync;
  let output: string = "";

  try {
    output = execSync(`${kustomizeCommand} ${path}`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return [];
  }

  const split = output.split("---");
  return split.flatMap((text) => {
    try {
      const r = textToK8sResource(text);
      r.where = { place: "kustomize", path: path };
      return r;
    } catch (e) {}
    return [];
  });
}

// check if kustomize is installed
function isKustomizeInstalled(): boolean {
  const execSync = require("child_process").execSync;
  let output: string = "";

  try {
    output = execSync(`kustomize version`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return false;
  }

  return true;
}

export function verifyKustomizeBuild(
  thisResource: K8sResource,
  text: string,
  fullText: string,
  filePath: string,
  shift: number
): vscode.Diagnostic[] {
  if (thisResource.kind !== "Kustomization") {
    return [];
  }

  const refType = "Kustomization";

  const regex = /kind: (Kustomization)/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    const start = (match.index || 0) + shift + match[0].indexOf(refType);
    const end = start + refType.length;

    const path = filePath.substring(0, filePath.lastIndexOf("/"));

    const execSync = require("child_process").execSync;
    let output: string = "";

    const success = (() => {
      try {
        output = execSync(`${kustomizeCommand} ${path}`, {
          encoding: "utf-8",
        });
        return true;
      } catch (e) {
        output = format(e.stderr);
        return false;
      }
    })();

    return createDiagnostic(
      start,
      end,
      fullText,
      success
        ? "✅ Kustomize build succeeded"
        : "❌ Kustomize build failed - " + output,
      success
        ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Error
    );
  });
}
