import { Highlight, K8sResource, LookupIncomingReferences } from "../types";
import * as vscode from "vscode";
import { format } from "util";
import { getAllYamlFileNamesInDirectory, getReferencesFromFile, textToK8sResourced } from "./util";
import { execSync } from "child_process";
import { getPositions } from "../finders/utils";

const kustomizeIsInstalled = isKustomizeInstalled();
const kustomizeCommand = kustomizeIsInstalled ? "kustomize build" : "kubectl kustomize";

export function getResources(): K8sResource[] {
  return getKustomizationPathsInWorkspace().flatMap((path) =>
    kustomizeBuild(path)
      .split("---")
      .flatMap((text) => textToK8sResourced(text, path, "kustomize") ?? [])
      .filter((i) => i.metadata.name)
  );
}

export function getKustomizationPathsInWorkspace(): string[] {
  return getAllYamlFileNamesInDirectory().filter(
    (file) => file.endsWith("kustomization.yml") || file.endsWith("kustomization.yaml")
  );
}

export function kustomizeBuild(file: string): string {
  const path = file.substring(0, file.lastIndexOf("/"));

  const execSync = require("child_process").execSync;

  try {
    return execSync(`${kustomizeCommand} ${path}`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return "";
  }
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
  doc: vscode.TextDocument,
  thisResource: K8sResource,
  text: string,
  shift: number
): Highlight[] {
  if (
    thisResource.kind !== "Kustomization" ||
    thisResource.apiVersion.includes("fluxcd") // skip if kustomize is from FluxCD
  ) {
    return [];
  }

  const filePath = thisResource.where.path;

  const isDirty = doc.isDirty;

  const refType = "Kustomization";

  const regex = /^kind: (Kustomization)/gm;
  const matches = text.matchAll(regex);

  return [...matches].flatMap((match) => {
    const position = getPositions(doc, match, shift, refType);

    const path = filePath.substring(0, filePath.lastIndexOf("/"));

    if (isDirty) {
      return {
        message: {
          type: "PlainText",
          content: "🧼 File is dirty - Please save the file first",
        },
        definition: thisResource,
        type: "dirty",
        position: position,
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
      definition: thisResource,
      type: success ? "success" : "error",
      position: position,
    };
  });
}

// export function getLookupIncomingReferencesKustomize(
//   kubeResources: K8sResource[]
// ): LookupIncomingReferences {
//   return getKustomizationPathsInWorkspace().reduce(
//     (acc, path) =>
//       getReferencesFromFile(
//         undefined,
//         kustomizeBuild(path),
//         kubeResources,
//         path,
//         "kustomize"
//       ).reduce((acc, i) => {
//         if (acc[i.definition.where.path]) {
//           acc[i.definition.where.path].push(i);
//         } else {
//           acc[i.definition.where.path] = [i];
//         }
//         return acc;
//       }, acc as LookupIncomingReferences),
//     {} as LookupIncomingReferences
//   );
// }
