import { K8sResource } from "./types";
import * as vscode from "vscode";
import { textToK8sResource } from "./extension";

// get all kubernetes resource names in folder and subfolders
export function getK8sResourceNamesInWorkspace(): K8sResource[] {
  const fs = require("fs");

  const files = getAllFileNamesInDirectory(
    vscode.workspace.workspaceFolders[0].uri.fsPath ?? ""
  );

  files.forEach((file) => {
    console.log(`file: ${file}`);
  });

  const resources: K8sResource[] = [];

  files.forEach((file) => {
    const fileText: string = fs.readFileSync(file, "utf8");
    const split = fileText.split("---");
    split.forEach((text) => {
      try {
        const r = textToK8sResource(text);
        r.where = "workspace";
        resources.push(r);
      } catch (e) {}
    });
  });

  resources.forEach((r) => {
    console.log(`resource name: ${r.metadata.name}`);
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

export function getClusterResources(k8sApi: any): K8sResource[] {
  let resources: K8sResource[] = [];
  k8sApi.listServiceForAllNamespaces().then((res) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r) => {
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
    console.log(resources);
    console.log("service name list updated");
  });
  k8sApi.listSecretForAllNamespaces().then((res) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r) => {
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
    console.log(resources);
    console.log("secrets with name updated");
  });
  k8sApi.listConfigMapForAllNamespaces().then((res) => {
    let s = res.body.items;
    resources.push(
      ...s.map((r) => {
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
    console.log(resources);
    console.log("ConfigMaps with name updated");
  });

  return resources;
}