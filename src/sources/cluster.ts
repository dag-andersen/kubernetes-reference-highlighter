import { CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { K8sResource } from "../types";

export type ClusterClient = {
  k8sApi: CoreV1Api;
  context: string;
};

export function getKubeClient(): ClusterClient | undefined {
  try {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(CoreV1Api);
    const context = kc.getCurrentContext();
    return { k8sApi, context };
  } catch (err) {
    console.log(err);
  }
  return undefined;
}

export async function getClusterResources(
  cc: ClusterClient
): Promise<K8sResource[]> {
  const service: Promise<K8sResource[]> = cc.k8sApi
    .listServiceForAllNamespaces()
    .then((res) => {
      return res.body.items.map((r): K8sResource => {
        return {
          kind: "Service",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          spec: r.spec,
        };
      });
    })
    .catch((_a) => {
      return [];
    });

  const secret: Promise<K8sResource[]> = cc.k8sApi
    .listSecretForAllNamespaces()
    .then((res) => {
      return res.body.items.map((r): K8sResource => {
        return {
          kind: "Secret",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          data: r.data,
        };
      });
    })
    .catch((_a) => {
      return [];
    });

  const configMap: Promise<K8sResource[]> = cc.k8sApi
    .listConfigMapForAllNamespaces()
    .then((res) => {
      return res.body.items.map((r): K8sResource => {
        return {
          kind: "ConfigMap",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
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
