import { Highlight, IncomingReference, K8sResource, LookupIncomingReferences } from "../types";
import * as vscode from "vscode";
import { getHighlights, textToK8sResource } from "../extension";
import { format } from "util";
import { getAllYamlFileNamesInDirectory } from "./util";
import { execSync } from "child_process";
import { getPositions } from "../finders/utils";
import { Prefs } from "../prefs";

const kustomizeIsInstalled = isKustomizeInstalled();
const kustomizeCommand = kustomizeIsInstalled ? "kustomize build" : "kubectl kustomize";

export function getKustomizeResources(): K8sResource[] {
  return getKustomizationPathsInWorkspace().flatMap((path) =>
    kustomizeBuild(path)
      .split("---")
      .flatMap((text) => textToWorkspaceK8sResource(text, path))
      .flatMap((x) => (x ? [x] : []))
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
  let output: string = "";

  try {
    output = execSync(`${kustomizeCommand} ${path}`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return "";
  }
  return output;
}

export function textToWorkspaceK8sResource(
  text: string,
  fileName: string
): K8sResource | undefined {
  try {
    return {
      ...textToK8sResource(text),
      where: { place: "kustomize", path: fileName },
    };
  } catch (e) {}
  return undefined;
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
  if (thisResource.kind !== "Kustomization") {
    return [];
  }

  const filePath = thisResource.where.path;

  const isDirty = doc.isDirty;

  const refType = "Kustomization";

  const regex = /kind: (Kustomization)/gm;
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

export function getLookupIncomingReferencesKustomize(
  kubeResources: K8sResource[]
): LookupIncomingReferences {
  const something = getKustomizationPathsInWorkspace().reduce((acc, path) => {
    return kustomizeBuild(path)
      .split("---")
      .flatMap((text) => (textToWorkspaceK8sResource(text, path) ? [{ text }] : []))
      .reduce((acc, { text }) => {
        const refs = getReferencesFromFile(undefined, text, kubeResources, path);
        return refs.reduce((acc, i) => {
          if (acc[i.definition.where.path]) {
            acc[i.definition.where.path].push(i);
          } else {
            acc[i.definition.where.path] = [i];
          }
          return acc;
        }, acc as LookupIncomingReferences);
      }, acc as LookupIncomingReferences);
  }, {} as LookupIncomingReferences);

  return something;
}

function getReferencesFromFile(
  doc: vscode.TextDocument | undefined,
  text: string,
  kubeResources: K8sResource[],
  fileName: string
): IncomingReference[] {
  let currentIndex = 0;
  const split = "---";
  return text
    .split(split)
    .flatMap((textSplit) => {
      const thisResource = textToWorkspaceK8sResource(textSplit, fileName);
      if (!thisResource) {
        currentIndex += textSplit.length + split.length;
        return [];
      }
      const highlights = getHighlights(
        doc,
        thisResource,
        kubeResources,
        [],
        textSplit,
        {} as Prefs,
        true,
        currentIndex
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.map((hh) => ({
        ref: h.thisResource,
        definition: hh.definition,
        message: hh.message,
      }))
    );
}
