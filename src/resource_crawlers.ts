import { K8sResource } from "./types";
import * as vscode from "vscode";
import { textToK8sResource } from "./extension";

// get all kubernetes resource names in folder and subfolders
export function getK8sResourceNamesInWorkspace(): K8sResource[] {
  const fs = require("fs");

    const workspaceFolders =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0].uri.fsPath;

    if (!workspaceFolders) {
      return [];
    }

  const files = getAllFileNamesInDirectory(workspaceFolders);

  const resources: K8sResource[] = [];

  files.forEach((file) => {
    const fileText: string = fs.readFileSync(file, "utf8");
    const split = fileText.split("---");
    split.forEach((text) => {
      try {
        const r = textToK8sResource(text);
        r.where = { place: "workspace", path: file };
        resources.push(r);
      } catch (e) {}
    });
  });

  return resources;
}

function getAllFileNamesInDirectory(dirPath: string) {
  const fs = require("fs");
  const path = require("path");

  let files: string[] = [];

  function walkSync(dir: string, fileList: string[]) {
    const files = fs.readdirSync(dir);
    files.forEach(function (file: string) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        fileList = walkSync(path.join(dir, file), fileList);
      } else {
        fileList.push(path.join(dir, file));
      }
    });

    return fileList;
  }

  files = walkSync(dirPath, files).filter((file: string) => {
    return file.endsWith(".yml") || file.endsWith(".yaml");
  });

  return files;
}

export function getKustomizeResources(): K8sResource[] {
  const kustomizationFiles = getKustomizationPathsInWorkspace();

  const resources = kustomizationFiles.flatMap((file) => {
    return kustomizeBuild(file);
  });

  return resources;
}

function getKustomizationPathsInWorkspace(): string[] {
  const workspaceFolders =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!workspaceFolders) {
    return [];
  }

  const kustomizationFiles = getAllFileNamesInDirectory(
    workspaceFolders
  ).filter((file) => {
    return file.endsWith("kustomization.yml");
  });

  return kustomizationFiles;
}

function kustomizeBuild(file: string): K8sResource[] {
  const path = file.substring(0, file.lastIndexOf("/"));

  const execSync = require("child_process").execSync;
  let output: string = "";

  try {
    output = execSync(`kustomize build ${path}`, {
      encoding: "utf-8",
    });
  } catch (e) {
    return [];
  }

  //const relativePathFromRoot = vscode.workspace.asRelativePath(file || "");

  const split = output.split("---");
  const resources: K8sResource[] = [];
  split.forEach((text) => {
    try {
      const r = textToK8sResource(text);
      r.where = { place: "kustomize", path: path };
      resources.push(r);
    } catch (e) {}
  });

  return resources;
}

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
