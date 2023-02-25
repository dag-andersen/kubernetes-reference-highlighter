import { K8sResource } from "../types";
import { getHighlights, textToK8sResource } from "../extension";
import { getAllYamlFilesInVsCodeWorkspace } from "./util";
import { Prefs } from "../prefs";
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

export function getLookupIncomingReferences(kubeResources: K8sResource[]): LookupIncomingReferences {
  let refToSource: LookupIncomingReferences = {};
  const files = getAllYamlFilesInVsCodeWorkspace();
  files.forEach(({ text, fileName }) => {
    getReferencesFromFile(text, kubeResources, fileName, 0).forEach((ref) => {
      const { thisResource, path, message } = ref;
      if (refToSource[path]) {
        refToSource[path].push({ resource: thisResource, message: message });
      } else {
        refToSource[path] = [{ resource: thisResource, message: message }];
      }
    });
  });

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
        { } as Prefs,
        currentIndex,
        true
      );
      currentIndex += textSplit.length + split.length;
      return { thisResource, highlights };
    })
    .flatMap((h) =>
      h.highlights.flatMap((hh) =>
        hh.source.path
          ? { thisResource: h.thisResource, path: hh.source?.path, message: hh.message }
          : []
      )
    );
}
