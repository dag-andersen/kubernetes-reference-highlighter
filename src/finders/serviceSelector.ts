import { V1Service } from "@kubernetes/client-node";
import { K8sResource, Highlight } from "../types";

export function find(resources: K8sResource[], thisResource: K8sResource, pwd: string, text: string): Highlight[] {
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
    .flatMap((r) => {
      let labels = getPodLabels(r);
      if (labels && compareLabels(selector, labels)) {
        return { resource: r, labels: labels };
      }
      return [];
    })
    .flatMap(
      (r): Highlight => ({
        start: start,
        type: "reference",
        message: {
          type: "ReferenceFound",
          targetName: r.resource.metadata.name,
          targetType: r.resource.kind,
          pwd,
          fromWhere: r.resource.where,
        },
      })
    );
}

const compareLabels = function (
  obj1: {
    [key: string]: string;
  },
  obj2: {
    [key: string]: string;
  }
) {
  const obj1Length = Object.keys(obj1).length;
  const obj2Length = Object.keys(obj2).length;

  if (obj1Length === obj2Length) {
    return Object.keys(obj1).every((key) => obj2.hasOwnProperty(key) && obj2[key] === obj1[key]);
  }
  return false;
};

function getPodLabels(resource: K8sResource):
  | {
      [key: string]: string;
    }
  | undefined {
  switch (resource.kind) {
    case "Pod":
      return resource.metadata.labels || undefined;
    case "ReplicaSet":
    case "Deployment":
    case "StatefulSet":
    case "DaemonSet":
      return resource.spec?.selector?.matchLabels || undefined;
    default:
      return undefined;
  }
}
