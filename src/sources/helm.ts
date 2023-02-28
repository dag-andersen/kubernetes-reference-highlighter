import { Highlight, K8sResource } from "../types";
import * as vscode from "vscode";
import { format } from "util";
import { getAllYamlFileNamesInDirectory, textToK8sResourced } from "./util";
import { getPositions } from "../finders/utils";

export const helmIsInstalled = isHelmInstalled();
const helmCommand = "helm template";

export function getHelmResources(): K8sResource[] {
  return getHelmPathsInWorkspace().flatMap((path) =>
    helmBuild(path)
      .split("---")
      .flatMap((text) => textToK8sResourced(text, path, "helm") ?? [])
  );
}

function getHelmPathsInWorkspace(): string[] {
  return getAllYamlFileNamesInDirectory().filter(
    (file) => file.endsWith("Chart.yml") || file.endsWith("Chart.yaml")
  );
}

function helmBuild(file: string): string {
  const path = file.substring(0, file.lastIndexOf("/"));

  const execSync = require("child_process").execSync;

  try {
    return execSync(`${helmCommand} ${path}`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return "";
  }
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
