import { V1Service } from "@kubernetes/client-node";
import { K8sResource, Highlight } from "../types";
import { logText } from "../utils";
import { similarity } from "./utils";

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  pwd: string,
  text: string,
  enableCorrectionHints: boolean,
  onlyReferences: boolean
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

      const regex = new RegExp(
        `(?:"|".*\\s+)(?:(?:http|https):\\/\\/)?${regexName}(?::(\\d{1,20}))?(?:(?:\\/|\\?)\\w*)*(?:"|\\s+.*")`,
        "g"
      );
      const matches = text.matchAll(regex);

      let resource = r as V1Service;

      return [...matches].flatMap((match) => {
        const port = match[1];
        const start = (match.index || 0) + 1;

        if (onlyReferences) {
          logText("only ref");
          const highlight: Highlight = {
            start: start,
            type: "reference",
            source: r.where,
            message: {
              type: "ReferencedBy",
              sourceName: thisResource.metadata.name,
              sourceType: thisResource.kind,
              charIndex: start,
              pwd,
              fromWhere: thisResource.where,
            },
          };
          return [highlight];
        }

        const portFound =
          port && resource.spec?.ports?.find((p) => p?.port === parseInt(port)) ? true : false;

        const serviceHighlight: Highlight = {
          start: start,
          type: "reference",
          source: thisResource.where,
          message: {
            type: "ServiceFreeTextFound",
            targetName: name,
            targetPort: portFound ? port : undefined,
            pwd,
            fromWhere: r.where,
          },
        };

        if (port && !portFound && enableCorrectionHints) {
          const ports = resource.spec?.ports?.map((p) => p?.port.toString());
          if (ports) {
            const portSuggestion: Highlight[] = similarity<string>(ports, port, (a) => a)
              .filter((a) => a.rating > 0.2)
              .map((a) => ({
                start: start,
                type: "hint",
                source: thisResource.where,
                message: {
                  type: "SubItemNotFound",
                  subType: "Port",
                  mainType: refType,
                  subName: port,
                  mainName: name,
                  suggestion: a.content,
                  pwd,
                  fromWhere: r.where,
                },
              }));
            return [serviceHighlight, ...portSuggestion];
          }
        }

        return serviceHighlight;
      });
    });
}
