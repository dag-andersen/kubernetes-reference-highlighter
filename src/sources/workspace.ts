import { K8sResource } from "../types";
import { getHighlights, textToK8sResource } from "../extension";
import { getAllYamlFilesInVsCodeWorkspace } from "./util";
import { Prefs } from "../prefs";
import { logText } from "../utils";
import { resourceLimits } from "worker_threads";
import { Message } from "../decorations/messages";

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

export function testtesttest(kubeResources: K8sResource[], prefs: Prefs): LookupIncomingReferences {
  let refToSource: LookupIncomingReferences = {};
  const files = getAllYamlFilesInVsCodeWorkspace();
  files.forEach(({ text, fileName }) => {
    getReferencesFromFile(text, kubeResources, fileName, prefs, 0).forEach((ref) => {
      const { thisResource, path, message } = ref;
      if (refToSource[path]) {
        refToSource[path].push({ resource: thisResource, message: message });
      } else {
        refToSource[path] = [{ resource: thisResource, message: message }];
      }
    });
  });

  // loop over record
  for (const [key, value] of Object.entries(refToSource)) {
    logText(`${key}: ${value.map((v) => v.resource.metadata.name).join(", ")}`);
  }

  return refToSource;
}

export type LookupIncomingReferences = Record<string, IncomingReference[]>;

export type IncomingReference = {
  resource: K8sResource;
  message: Message;
};

function getReferencesFromFile(
  text: string,
  kubeResources: K8sResource[],
  fileName: string,
  prefs: Prefs,
  currentIndex: number
): {
  thisResource: K8sResource;
  path: string;
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
        prefs,
        currentIndex
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.flatMap((hh) =>
        hh.originalSource?.path
          ? { thisResource: h.thisResource, path: hh.originalSource?.path, message: hh.message }
          : []
      )
    );
}
