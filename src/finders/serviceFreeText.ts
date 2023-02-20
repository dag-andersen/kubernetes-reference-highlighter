import { K8sResource, Highlight } from "../types";

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
    .filter((r) => r.metadata.namespace || !!!thisResource.metadata.namespace)
    .flatMap((r) => {
      const { name, regexName } = r.metadata.namespace 
        ? thisResource.metadata.namespace === r.metadata.namespace
          ? {
              name: r.metadata.name,
              regexName: `(?:${r.metadata.name}|${r.metadata.name}\.${r.metadata.namespace}(?:\.svc|\.svc\.cluster|\.svc\.cluster\.local)?)`,
            }
          : {
              name: `${r.metadata.name}\.${r.metadata.namespace}`,
              regexName: `${r.metadata.name}\.${r.metadata.namespace}(?:\.svc|\.svc\.cluster|\.svc\.cluster\.local)?`,
            }
        : {
            name: r.metadata.name,
            regexName: r.metadata.name,
          };

      const regex = new RegExp(`(?:"|".*\\s+)(?:(?:http|https):\\/\\/)?${regexName}(?::(\\d{1,5}))?(?:(?:\\/|\\?)\\w*)*(?:"|\\s+.*")`, "g");
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
