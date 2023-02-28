import { IncomingReference, K8sResource, LookupIncomingReferences } from "../types";
import { getHighlights, textToK8sResource } from "../extension";
import { getAllYamlFilesInVsCodeWorkspace } from "./util";
import { Prefs } from "../prefs";
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
  kubeResources: K8sResource[]
): LookupIncomingReferences {
  return getAllYamlFilesInVsCodeWorkspace().reduce(
    (acc, { text, fileName, doc: doc }) =>
      getReferencesFromFile(doc, text, kubeResources, fileName).reduce((acc, i) => {
        if (acc[i.definition.where.path]) {
          acc[i.definition.where.path].push(i);
        } else {
          acc[i.definition.where.path] = [i];
        }
        return acc;
      }, acc),
    {} as LookupIncomingReferences
  );
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
