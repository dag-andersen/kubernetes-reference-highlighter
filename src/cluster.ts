import { K8sResource } from "./types";

export function getClusterResources(k8sApi: any): K8sResource[] {
  let resources: K8sResource[] = [];
  k8sApi.listServiceForAllNamespaces().then((res: any) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r: any) => {
        return {
          kind: "Service",
          metadata: {
            name: r.metadata.name,
            namespace: r.metadata.namespace,
          },
          where: "cluster",
        };
      })
    );
    console.log("service name list updated");
  });
  k8sApi.listSecretForAllNamespaces().then((res: any) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r: any) => {
        return {
          kind: "Secret",
          metadata: {
            name: r.metadata.name,
            namespace: r.metadata.namespace,
          },
          where: "cluster",
        };
      })
    );
    console.log("secrets with name updated");
  });
  k8sApi.listConfigMapForAllNamespaces().then((res: any) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r: any) => {
        return {
          kind: "ConfigMap",
          metadata: {
            name: r.metadata.name,
            namespace: r.metadata.namespace,
          },
          where: "cluster",
        };
      })
    );
    console.log("ConfigMaps with name updated");
  });

  return resources;
}