import { CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { K8sResource } from "../types";

export function getKubeClient() {
  try {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(CoreV1Api);
    return k8sApi;
  } catch (err) {
    console.log(err);
  }
  return undefined;
}

export function getClusterResources(k8sApi: CoreV1Api): K8sResource[] {
  let resources: K8sResource[] = [];
  k8sApi.listServiceForAllNamespaces().then((res) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r) : K8sResource => {
        return {
          kind: "Service",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
          },
          where: "cluster",
          spec: r.spec,
        };
      })
    );
    console.log("service name list updated");
  });
  k8sApi.listSecretForAllNamespaces().then((res) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r) : K8sResource => {
        return {
          kind: "Secret",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
          },
          where: "cluster",
          data: r.data,
        };
      })
    );
    console.log("secrets with name updated");
  });
  k8sApi.listConfigMapForAllNamespaces().then((res) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r) : K8sResource => {
        return {
          kind: "ConfigMap",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
          },
          where: "cluster",
          data: r.data,
        };
      })
    );
    console.log("ConfigMaps with name updated");
  });

  return resources;
}
