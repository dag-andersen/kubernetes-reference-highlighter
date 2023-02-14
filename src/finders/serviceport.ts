import { V1Service, V1ServiceSpec } from "@kubernetes/client-node";
import { K8sResource, Highlight } from "../types";
import { logText } from "../utils";

export function find(
  resources: K8sResource[],
  thisResource: K8sResource,
  pwd: string,
  text: string
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
  //logText(`match: ${JSON.stringify(match)}, stat: ${start}`);

  const refType = "Service";
  let resource = thisResource as V1Service;

  const selector = resource.spec?.selector;
  //logText(`hej: ${JSON.stringify(selector)}`);
  if (!selector) {
    return [];
  }

  return resources
    .flatMap((r) => {
      let labels = getPodLabels(r);
      if (labels && haveSameData(selector, labels)) {
        logText(`match!: ${JSON.stringify(labels)}`);
        return { resource: r, labels: labels };
      }
      logText(`no match`);
      return [];
    })
    .flatMap((r) => {
      const test: Highlight = {
        start: start,
        type: "reference",
        message: {
          type: refType,
          name: r.resource.metadata.name,
          pwd,
          fromWhere: r.resource.where,
        },
      };
      logText(`Found: ${test.type}`);
      return test;
    });
}

const haveSameData = function (
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
    return Object.keys(obj1).every(
      (key) => obj2.hasOwnProperty(key) && obj2[key] === obj1[key]
    );
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
