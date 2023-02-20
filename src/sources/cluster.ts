import { CoreV1Api, AppsV1Api, BatchV1Api, KubeConfig } from "@kubernetes/client-node";
import { K8sResource } from "../types";

export type ClusterClient = {
  coreV1Api: CoreV1Api;
  appsApi: AppsV1Api;
  batchV1Api: BatchV1Api;
  context: string;
};

export function getKubeClient(): ClusterClient | undefined {
  try {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const coreV1Api = kc.makeApiClient(CoreV1Api);
    const appsApi = kc.makeApiClient(AppsV1Api);
    const batchV1Api = kc.makeApiClient(BatchV1Api);
    const context = kc.getCurrentContext();
    return { coreV1Api, appsApi, batchV1Api, context };
  } catch (err) {
    console.log(err);
  }
  return undefined;
}

export async function getClusterResources(cc: ClusterClient): Promise<K8sResource[]> {
  const service: Promise<K8sResource[]> = cc.coreV1Api
    .listServiceForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "Service",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          spec: r.spec,
        })
      );
    })
    .catch((_a) => []);

  const secret: Promise<K8sResource[]> = cc.coreV1Api
    .listSecretForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "Secret",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          data: r.data,
        })
      );
    })
    .catch((_a) => []);

  const configMap: Promise<K8sResource[]> = cc.coreV1Api
    .listConfigMapForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "ConfigMap",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          data: r.data,
        })
      );
    })
    .catch((_a) => []);

  const deployments: Promise<K8sResource[]> = cc.appsApi
    .listDeploymentForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "Deployment",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          spec: r.spec,
        })
      );
    })
    .catch((_a) => []);

  const statefulSets: Promise<K8sResource[]> = cc.appsApi
    .listStatefulSetForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "StatefulSet",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          spec: r.spec,
        })
      );
    })
    .catch((_a) => []);

  const daemonSets: Promise<K8sResource[]> = cc.appsApi
    .listDaemonSetForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "DaemonSet",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          spec: r.spec,
        })
      );
    })
    .catch((_a) => []);

  const cronJobs: Promise<K8sResource[]> = cc.batchV1Api
    .listCronJobForAllNamespaces()
    .then((res) => {
      return res.body.items.map(
        (r): K8sResource => ({
          kind: "CronJob",
          metadata: {
            name: r.metadata?.name || "",
            namespace: r.metadata?.namespace || "",
            labels: r.metadata?.labels || {},
          },
          where: { place: "cluster", context: cc.context },
          spec: r.spec,
        })
      );
    })
    .catch((_a) => []);

  return Promise.all([service, secret, configMap, deployments, statefulSets, daemonSets, cronJobs])
    .then((a) => a.flat())
    .catch((_a) => []);
}
