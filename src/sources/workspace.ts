import { K8sResource, LookupIncomingReferences } from "../types";
import {
  getAllYamlFilesInVsCodeWorkspace,
  getReferencesFromFile,
  textToK8sResourced,
} from "./util";

export function getK8sResourcesInWorkspace(): K8sResource[] {
  return getAllYamlFilesInVsCodeWorkspace().flatMap(({ fileName, text }) =>
    text
      .split("---")
      .flatMap((text) => textToK8sResourced(text, fileName, "workspace") ?? [])
      .filter((i) => i.metadata.name) // Check that it has a name that can be referenced
  );
}

export function getLookupIncomingReferences(
  kubeResources: K8sResource[]
): LookupIncomingReferences {
  return getAllYamlFilesInVsCodeWorkspace().reduce(
    (acc, { text, fileName, doc: doc }) =>
      getReferencesFromFile(doc, text, kubeResources, fileName, "workspace").reduce((acc, i) => {
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
