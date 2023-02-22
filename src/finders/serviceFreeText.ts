import { V1Service } from "@kubernetes/client-node";
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

      const regex = new RegExp(`(?:"|".*\\s+)(?:(?:http|https):\\/\\/)?${regexName}(?::(\\d{1,20}))?(?:(?:\\/|\\?)\\w*)*(?:"|\\s+.*")`, "g");
      const matches = text.matchAll(regex);

      let resource = r as V1Service;

      return [...matches].map((match) => {
        const port = match[1];
        const portFound = resource.spec?.ports?.find((p: any) => p?.port === parseInt(port)) ? true : false;

        const start = (match.index || 0) + 1;
        return {
          start: start,
          type: "reference",
          message: {
            type: "ServiceFreeTextFound",
            targetName: name,
            targetPort: portFound ? port : undefined,
            pwd,
            fromWhere: r.where,
          },
        };
      });
    });
}
