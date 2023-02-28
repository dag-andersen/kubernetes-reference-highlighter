import { Highlight, K8sResource } from "../types";
import * as vscode from "vscode";
import { format } from "util";
import { getAllYamlFileNamesInDirectory, textToK8sResourced } from "./util";
import { getPositions } from "../finders/utils";

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
  const helmChartFiles = getAllYamlFileNamesInDirectory().filter(
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

  return output.split("---").flatMap((text) => textToK8sResourced(text, file, "helm") ?? []);
}

export function verifyHelmBuild(
  doc: vscode.TextDocument,
  thisResource: K8sResource,
  text: string,
  shift: number
): Highlight[] {
  // check if thisResource.kind is null or undefined
  if (thisResource.kind) {
    return [];
  }

  const filePath = thisResource.where.path;

  // TODO: check if dirty

  const regex = /name:\s*([a-zA-Z-]+)/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    const name = match[1];
    const position = getPositions(doc, match, shift, name);

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
      position: position,
      definition: thisResource,
      message: {
        type: "PlainText",
        content: success ? "✅ Helm build succeeded" : "❌ Helm build failed - " + output,
      },
      type: success ? "success" : "error",
    };
  });
}
