import { Highlight, K8sResource } from "../types";
import * as vscode from "vscode";
import { textToK8sResource } from "../extension";
import { format } from "util";
import { getAllYamlFileNamesInDirectory } from "./util";
import { execSync } from "child_process";

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
  const kustomizationFiles = getAllYamlFileNamesInDirectory().filter(
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
      return {
        ...textToK8sResource(text),
        where: { place: "kustomize", path: file },
      };
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
  filePath: string,
  shift: number
): Highlight[] {
  if (thisResource.kind !== "Kustomization") {
    return [];
  }

  const isDirty = vscode.workspace.textDocuments.find(
    (doc) => doc.fileName === filePath
  )?.isDirty;

  const refType = "Kustomization";

  const regex = /kind: (Kustomization)/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    const start = (match.index || 0) + shift + match[0].indexOf(refType);

    const path = filePath.substring(0, filePath.lastIndexOf("/"));

    if (isDirty) {
      return {
        message: {
          type: "PlainText",
          content: "🧼 File is dirty - Please save the file first",
        },
        source: thisResource,
        type: "dirty",
        start: start,
      };
    }

    let output: string = "";

    const success = (() => {
      try {
        output = execSync(`${kustomizeCommand} ${path}`, {
          encoding: "utf-8",
        });
        return true;
      } catch (e: any) {
        output = format(e.stderr);
        return false;
      }
    })();

    return {
      message: {
        type: "PlainText",
        content: success ? "✅ Kustomize build succeeded" : "❌ Kustomize build failed - " + output,
      },
      source: thisResource,
      type: success ? "success" : "error",
      start: start,
    };
  });
}
