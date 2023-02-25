import { K8sResource } from "../types";
import { getHighlights, textToK8sResource } from "../extension";
import { getAllYamlFilesInVsCodeWorkspace } from "./util";
import { Prefs } from "../prefs";
import { Message } from "../decorations/messages";
import * as vscode from "vscode";

export function getK8sResourcesInWorkspace(): K8sResource[] {
  return getAllYamlFilesInVsCodeWorkspace().flatMap(({ fileName, text }) =>
    text.split("---").flatMap((text) => textToWorkspaceK8sResource(text, fileName) ?? [])
  );
}

export function textToWorkspaceK8sResource(
  text: string,
  fileName: string
): K8sResource | undefined {
  try {
    return {
      ...textToK8sResource(text),
      where: { place: "workspace", path: fileName },
    };
  } catch (e) {}
  return undefined;
}

export function getLookupIncomingReferences(
  kubeResources: K8sResource[],
): LookupIncomingReferences {
  return getAllYamlFilesInVsCodeWorkspace().reduce(
    (acc, { text, fileName }) =>
      getReferencesFromFile(text, kubeResources, fileName, 0).reduce(
        (acc, { definition, message, ref }) => {
          if (acc[definition.where.path]) {
            acc[definition.where.path].push({
              definition: definition,
              ref: ref,
              message: message,
            });
          } else {
            acc[definition.where.path] = [{ definition: definition, ref: ref, message: message }];
          }
          return acc;
        },
        acc
      ),
    {} as LookupIncomingReferences
  );
}

export const toPath = (path: string) => vscode.workspace.asRelativePath(path || "");

export type LookupIncomingReferences = Record<string, IncomingReference[]>;

export type IncomingReference = {
  ref: K8sResource; // delete this???
  definition: K8sResource;
  message: Message;
};

function getReferencesFromFile(
  text: string,
  kubeResources: K8sResource[],
  fileName: string,
  currentIndex: number
): {
  ref: K8sResource;
  definition: K8sResource;
  message: Message;
}[] {
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
        thisResource,
        kubeResources,
        [],
        fileName,
        textSplit,
        { } as Prefs,
        currentIndex,
        true
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.map((hh) => ({
        ref: h.thisResource,
        definition: hh.source,
        message: hh.message,
      }))
    );
}
