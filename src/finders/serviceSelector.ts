import * as vscode from "vscode";
import { V1Service } from "@kubernetes/client-node";
import { K8sResource, Highlight } from "../types";
import { getPositions } from "./utils";

export function find(
  doc: vscode.TextDocument | undefined,
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string,
  onlyReferences: boolean,
  shift: number
): Highlight[] {
  if (thisResource.kind !== "Service") {
    return [];
  }

  let regex = /^  selector:\s/gm;
  let matches = text.matchAll(regex);
  let list = [...matches];

  if (list.length !== 1) {
    return [];
  }

  let match = list[0];

  const position = getPositions(doc, match, shift);

  let resource = thisResource as V1Service;

  const selector = resource.spec?.selector;

  if (!selector) {
    return [];
  }

  return resources
    .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
    .filter((r) => {
      let labels = getPodLabels(r);
      return labels && isSubset(selector, labels);
    })
    .flatMap(
      (r): Highlight =>
        onlyReferences
          ? {
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
            }
          : {
              position: position,
              type: "reference",
              definition: r,
              message: {
                type: "ReferenceFound",
                targetName: r.metadata.name,
                targetType: r.kind,
                pwd: thisResource.where.path,
                fromWhere: r.where,
              },
            }
    );
}

const isSubset = function (
  potentialSubset: {
    [key: string]: string;
  },
  set: {
    [key: string]: string;
  }
) {
  return Object.keys(potentialSubset).every((key) => set.hasOwnProperty(key) && set[key] === potentialSubset[key]);
};

function getPodLabels(resource: K8sResource):
  | {
      [key: string]: string;
    }
  | undefined {
  switch (resource.kind) {
    case "Pod":
      return resource.metadata.labels || undefined;
    case "Job":
    case "ReplicaSet":
    case "Deployment":
    case "StatefulSet":
    case "DaemonSet":
      return resource.spec?.template?.metadata?.labels || undefined;
    case "CronJob":
      return resource.spec?.jobTemplate?.spec?.template?.metadata?.labels || undefined;
    default:
      return undefined;
  }
}
