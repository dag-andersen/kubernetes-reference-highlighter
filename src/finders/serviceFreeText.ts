import { K8sResource, Highlight } from "../types";

/*
  TODO: fix that it is matching on http://prod.system1-service.default:5000 even though prod does not exist
*/

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  pwd: string,
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

      const regex = new RegExp(`(?:"|".*[^a-z0-9A-Z-])${name}(?:"|[^a-z0-9A-Z-].*")`, "g");
      const matches = text.matchAll(regex);

      return [...matches].map((match): Highlight => {
        const start = (match.index || 0) + 1;
        return {
          start: start,
          type: "reference",
          message: {
            type: "ReferenceFound",
            targetType: refType,
            targetName: name,
            pwd,
            fromWhere: r.where,
          },
        };
      });
    });
}
