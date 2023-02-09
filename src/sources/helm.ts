import { Highlight, K8sResource } from "../types";
import * as vscode from "vscode";
import { textToK8sResource } from "../extension";
import { getAllFileNamesInDirectory } from "../extension";
import { format } from "util";

const helmCommand = "helm template";

export function getHelmResources(): K8sResource[] {
  const helmChartFiles = getHelmPathsInWorkspace();

  const resources = helmChartFiles.flatMap(helmBuild);

  return resources;
}

export const helmIsInstalled = isHelmInstalled();

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

function getHelmPathsInWorkspace(): string[] {
  const workspaceFolders =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!workspaceFolders) {
    return [];
  }

  const helmChartFiles = getAllFileNamesInDirectory(workspaceFolders).filter(
    (file) => file.endsWith("Chart.yml") || file.endsWith("Chart.yaml")
  );

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

export function verifyHelmBuild(
  thisResource: K8sResource,
  text: string,
  filePath: string,
  shift: number
): Highlight[] {
  // check if thisResource.kind is null or undefined
  if (thisResource.kind) {
    return [];
  }

  const regex = /name:\s*([a-zA-Z-]+)/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    const name = match[1];
    const start = (match.index || 0) + shift + match[0].indexOf(name);

    const path = filePath.substring(0, filePath.lastIndexOf("/"));

    const execSync = require("child_process").execSync;
    let output: string = "";

    const success = (() => {
      try {
        output = execSync(`${helmCommand} ${path}`, {
          encoding: "utf-8",
        });
        return true;
      } catch (e: any) {
        output = format(e.stderr);
        return false;
      }
    })();

    return {
      start,
      message: {
        content: success
          ? "✅ Helm build succeeded"
          : "❌ Helm build failed - " + output,
      },
      type: success ? "success" : "error",
    };
  });
}
