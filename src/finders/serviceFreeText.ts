import * as vscode from "vscode";
import { V1Service } from "@kubernetes/client-node";
import { K8sResource, Highlight } from "../types";
import { getPositions, similarity } from "./utils";

export function find(
  doc: vscode.TextDocument | undefined,
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string,
  enableCorrectionHints: boolean,
  onlyReferences: boolean,
  shift: number
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

        const position = getPositions(doc, match, shift);

        if (onlyReferences) {
          const highlight: Highlight = {
            position: position,
            type: "reference",
            definition: r,
            message: {
              type: "ReferencedBy",
              sourceName: thisResource.metadata.name,
              sourceType: thisResource.kind,
              lineNumber: position?.line,
              pwd: r.where.path,
              fromWhere: thisResource.where,
            },
          };
          return [highlight];
        }

        const portFound =
          port && resource.spec?.ports?.find((p) => p?.port === parseInt(port)) ? true : false;

        const serviceHighlight: Highlight = {
          position: position,
          type: "reference",
          definition: r,
          message: {
            type: "ServiceFreeTextFound",
            targetName: name,
            targetPort: portFound ? port : undefined,
            pwd: thisResource.where.path,
            fromWhere: r.where,
          },
        };

        if (port && !portFound && enableCorrectionHints) {
          const ports = resource.spec?.ports?.map((p) => p?.port.toString());
          if (ports) {
            const portSuggestion: Highlight[] = similarity<string>(ports, port, (a) => a)
              .filter((a) => a.rating > 0.2)
              .map((a) => ({
                position: position,
                type: "hint",
                definition: r,
                message: {
                  type: "SubItemNotFound",
                  subType: "Port",
                  mainType: refType,
                  subName: port,
                  mainName: name,
                  suggestion: a.content,
                  pwd: thisResource.where.path,
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
