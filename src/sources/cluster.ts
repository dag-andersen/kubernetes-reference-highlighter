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

export async function getClusterResources(
  k8sApi: CoreV1Api
): Promise<K8sResource[]> {
  let service: Promise<K8sResource[]> = k8sApi
    .listServiceForAllNamespaces()
    .then((res) => {
      return res.body.items.map((r): K8sResource => {
        return {
          kind: "Service",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
          },
          where: "cluster",
          spec: r.spec,
        };
      });
    })
    .catch((_a) => {
      return [];
    });

  let secret: Promise<K8sResource[]> = k8sApi
    .listSecretForAllNamespaces()
    .then((res) => {
      return res.body.items.map((r): K8sResource => {
        return {
          kind: "Secret",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
          },
          where: "cluster",
          data: r.data,
        };
      });
    })
    .catch((_a) => {
      return [];
    });

  let configMap: Promise<K8sResource[]> = k8sApi
    .listConfigMapForAllNamespaces()
    .then((res) => {
      return res.body.items.map((r): K8sResource => {
        return {
          kind: "ConfigMap",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
          },
          where: "cluster",
          data: r.data,
        };
      });
    })
    .catch((_a) => {
      return [];
    });

  return Promise.all([service, secret, configMap])
    .then((a) => {
      return [...a[0], ...a[1], ...a[2]];
    })
    .catch((_a) => {
      return [];
    });
}
