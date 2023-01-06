import { K8sResource } from "./types";
import * as vscode from "vscode";
import { textToK8sResource, createDiagnostic } from "./extension";
import { getAllFileNamesInDirectory } from "./extension";

const helmCommand = "helm template";

export function getHelmResources(): K8sResource[] {
  const helmChartFiles = getHelmPathsInWorkspace();

  const resources = helmChartFiles.flatMap(helmBuild);

  return resources;
}

function getHelmPathsInWorkspace(): string[] {
  const workspaceFolders =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!workspaceFolders) {
    return [];
  }

  const helmChartFiles = getAllFileNamesInDirectory(
    workspaceFolders
  ).filter((file) => {
    return file.endsWith("Chart.yml") || file.endsWith("Chart.yaml");
  });

  return helmChartFiles;
}

function helmBuild(file: string): K8sResource[] {
  const path = file.substring(0, file.lastIndexOf("/"));

  const execSync = require("child_process").execSync;
  let output: string = "";

  try {
    output = execSync(`${helmCommand} ${path}`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return [];
  }

  const split = output.split("---");
  return split.flatMap((text) => {
    try {
      const r = textToK8sResource(text);
      r.where = { place: "helm", path: path };
      return r;
    } catch (e) {}
    return [];
  });
}

export function isHelmInstalled(): boolean {
  const execSync = require("child_process").execSync;
  let output: string = "";

  try {
    output = execSync(`helm version`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return false;
  }

  return true;
}

export function verifyHelmBuild(
  thisResource: K8sResource,
  text: string,
  fullText: string,
  filePath: string,
  shift: number
): vscode.Diagnostic[] {

  // check if thisResource.kind is null or undefined
  if (thisResource.kind) {
    return [];
  }

  const regex = /name:\s*([a-zA-Z-]+)/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    const name = match[1];
    const start = (match.index || 0) + shift + match[0].indexOf(name);
    const end = start + name.length;

    const path = filePath.substring(0, filePath.lastIndexOf("/"));

    const execSync = require("child_process").execSync;
    let output: string = "";

    const success = (() => {
      try {
        output = execSync(`${helmCommand} ${path}`, {
          encoding: "utf-8",
        });
        return true;
      } catch (e) {
        return false;
      }
    })();

    return createDiagnostic(
      start,
      end,
      fullText,
      success ? "✅ Helm build succeeded" : "❌ Helm build failed",
      success
        ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Error
    );
  });
}
