import { K8sResource } from "./types";
import * as vscode from "vscode";
import {
  textToK8sResource,
  diagnosticCollection,
  createDiagnostic,
} from "./extension";
import { getAllFileNamesInDirectory } from "./extension";

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
  ).filter((file) => {
    return file.endsWith("kustomization.yml");
  });

  return kustomizationFiles;
}

function kustomizeBuild(file: string): K8sResource[] {
  const path = file.substring(0, file.lastIndexOf("/"));

  const execSync = require("child_process").execSync;
  let output: string = "";

  try {
    output = execSync(`kustomize build ${path}`, {
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
export function isKustomizeInstalled(): boolean {
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
