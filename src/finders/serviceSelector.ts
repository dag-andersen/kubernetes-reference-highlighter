import { V1Service } from "@kubernetes/client-node";
import { K8sResource, Highlight } from "../types";

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  pwd: string,
  text: string,
  onlyReferences: boolean
): Highlight[] {
  if (thisResource.kind !== "Service") {
    return [];
  }

  let regex = /  selector:\s/g;
  let matches = text.matchAll(regex);
  let list = [...matches];

  if (list.length !== 1) {
    return [];
  }

  let match = list[0];

  const start = (match.index || 0) + 1;

  let resource = thisResource as V1Service;

  const selector = resource.spec?.selector;

  if (!selector) {
    return [];
  }

  return resources
    .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
    .flatMap((r) => {
      let labels = getPodLabels(r);
      if (labels && isSubset(selector, labels)) {
        return { resource: r, labels: labels };
      }
      return [];
    })
    .flatMap(
      (r): Highlight =>
        onlyReferences
          ? {
              start: start,
              type: "reference",
              definition: r.resource,
              message: {
                type: "ReferencedBy",
                sourceName: thisResource.metadata.name,
                sourceType: thisResource.kind,
                pwd,
                fromWhere: thisResource.where,
              },
            }
          : {
              start: start,
              type: "reference",
              definition: r.resource,
              message: {
                type: "ReferenceFound",
                targetName: r.resource.metadata.name,
                targetType: r.resource.kind,
                pwd,
                fromWhere: r.resource.where,
              },
            }
    );
}

const isSubset = function (
  a: {
    [key: string]: string;
  },
  b: {
    [key: string]: string;
  }
) {
  return Object.keys(a).every((key) => b.hasOwnProperty(key) && b[key] === a[key]);
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
