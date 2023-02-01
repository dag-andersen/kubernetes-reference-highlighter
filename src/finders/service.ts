import { K8sResource, Highlight } from "../types";
import { generateMessage } from "./utils";

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  activeFilePath: string,
  text: string
): Highlight[] {
  if (thisResource.kind === "Ingress" || thisResource.kind === "Service") {
    return [];
  }

  const refType = "Service";

  return resources
    .filter((r) => r.kind === refType)
    .flatMap((r) => {
      const name =
        thisResource.metadata.namespace === r.metadata.namespace
          ? r.metadata.name
          : `${r.metadata.name}.${r.metadata.namespace}`;

      const regex = new RegExp(`(?:"|".*[^a-zA-Z-])${name}(?:"|[^a-zA-Z-].*")`, "g");
      const matches = text.matchAll(regex);

      return [...matches].map((match) => {
        const start = (match.index || 0) + 1;
        const end = start + name.length;
        return {
          start: start,
          end: end,
          message: generateMessage(refType, name, activeFilePath, r.where),
        };
      });
    });
}
