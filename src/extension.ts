// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as workspace from "./workspace";
import * as cluster from "./cluster";
import * as kustomize from "./kustomize";
import * as finders from "./finders";

import { FromWhere, K8sResource } from "./types";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "Kubernetes Reference Highlighter" is now active!');

  const k8s = require("@kubernetes/client-node");
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let kubeResourcesKustomize: K8sResource[] = [];
  let enableWorkSpaceScanning = true;
  let enableWorkSpaceKustomizeScanning = kustomize.isKustomizeInstalled();
  let enableClusterScanning = true;

  const enableWorkSpaceScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableWorkSpaceScanning",
    () => {
      enableWorkSpaceScanning = !enableWorkSpaceScanning;
      vscode.window.showInformationMessage(
        `WorkSpace Scanning: ${enableWorkSpaceScanning ? "Enabled" : "Disabled"}`
      );
      if (enableWorkSpaceScanning) {
        updateK8sResourcesFromWorkspace();
      } else {
        kubeResourcesWorkspace = [];
      }
    }
  );

  const enableClusterScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableClusterScanning",
    () => {
      enableClusterScanning = !enableClusterScanning;
      vscode.window.showInformationMessage(
        `Cluster Scanning: ${enableClusterScanning ? "Enabled" : "Disabled"}`
      );
      if (enableClusterScanning) {
        updateK8sResourcesFromCluster();
      } else {
        kubeResourcesCluster = [];
      }
    }
  );

  const enableKustomizeScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableKustomizeScanning",
    () => {
      if (!kustomize.isKustomizeInstalled()) {
        vscode.window.showErrorMessage(
          "Kustomize is not installed. Please install it first."
        );
        return;
      }
      enableWorkSpaceKustomizeScanning = !enableWorkSpaceKustomizeScanning;
      vscode.window.showInformationMessage(
        `Kustomize Scanning: ${
          enableWorkSpaceKustomizeScanning ? "Enabled" : "Disabled"
        }`
      );
      if (enableWorkSpaceKustomizeScanning) {
        updateK8sResourcesFromKustomize();
      } else {
        kubeResourcesKustomize = [];
      }
    }
  );

  const updateK8sResourcesFromWorkspace = () => {
    if (!enableWorkSpaceScanning) {
      return;
    }
    kubeResourcesWorkspace = workspace.getK8sResourceNamesInWorkspace();
  };

  const updateK8sResourcesFromCluster = () => {
    if (!enableClusterScanning) {
      return;
    }
    kubeResourcesCluster = cluster.getClusterResources(k8sApi);
  };

  const updateK8sResourcesFromKustomize = () => {
    if (!enableWorkSpaceKustomizeScanning) {
      return;
    }
    kubeResourcesKustomize = kustomize.getKustomizeResources();
  };

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("kubernetes-reference-highlighter");

  let lastDocument = "";

  const updateDiagnostics = (doc: vscode.TextDocument) => {
    const fileName = doc.fileName;
    if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) {
      return;
    }

    const fileText = doc.getText();
    if (fileText === lastDocument) {
      return;
    }
    lastDocument = fileText;

    const split = "---";

    const fileTextSplitted = fileText.split(split);

    let currentIndex = 0;

    const kubeResources = [
      ...kubeResourcesCluster,
      ...kubeResourcesWorkspace,
      ...kubeResourcesKustomize,
    ];

    const diagnosticsCombined = fileTextSplitted.flatMap((textSplit) => {
      let thisResource: K8sResource;

      try {
        thisResource = textToK8sResource(textSplit);
      } catch (e) {
        currentIndex += textSplit.length + split.length;
        return [];
      }

      if (!thisResource.kind) {
        currentIndex += textSplit.length + split.length;
        return [];
      }

      firstTimeK8sObjectFound(); // first time finding a k8s object

      const serviceHighlights = finders.findServices(
        kubeResources,
        thisResource,
        textSplit
      );
      const valueFromHighlights = finders.findValueFromKeyRef(
        kubeResources,
        thisResource,
        textSplit
      );
      const ingressHighlights = finders.findIngressService(
        kubeResources,
        thisResource,
        textSplit
      );
      const highlights = [
        ...serviceHighlights,
        ...valueFromHighlights,
        ...ingressHighlights,
      ];

      let diagnostics = highlights.map((h) => {
        const message = generateMessage(h.type, h.name, fileName, h.from);
        return createDiagnostic(
          h.start + currentIndex,
          h.end + currentIndex,
          fileText,
          message
        );
      });

      if (
        enableKustomizeScanningCommand &&
        (fileName.endsWith("kustomization.yaml") || fileName.endsWith("kustomization.yml"))
      ) {
        diagnostics.push(
          ...kustomize.verifyKustomizeBuild(
            thisResource,
            textSplit,
            fileText,
            fileName,
            currentIndex
          )
        );
      }

      currentIndex += textSplit.length + split.length;
      return diagnostics;
    });

    diagnosticCollection.set(doc.uri, diagnosticsCombined);
  };

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!foundFirstK8sObject) {
      return;
    }

    if (!doc.fileName.endsWith(".yaml") && !doc.fileName.endsWith(".yml")) {
      return;
    }

    const fileText = doc.getText();
    if (fileText === lastDocument) {
      return;
    }
    lastDocument = fileText;

    updateK8sResourcesFromCluster();
    updateK8sResourcesFromWorkspace();
    updateK8sResourcesFromKustomize();
  });

  const onOpen = vscode.workspace.onDidOpenTextDocument(updateDiagnostics);
  const onChange = vscode.workspace.onDidChangeTextDocument((event) =>
    updateDiagnostics(event.document)
  );

  context.subscriptions.push(
    enableClusterScanningCommand,
    enableWorkSpaceScanningCommand,
    enableKustomizeScanningCommand,
    diagnosticCollection,
    onSave,
    onChange,
    onOpen
  );

  let foundFirstK8sObject = false;
  const firstTimeK8sObjectFound = () => {
    if (foundFirstK8sObject) {
      return;
    }
    vscode.window.showInformationMessage(
      "Kubernetes Reference Highlighter starting!"
    );
    foundFirstK8sObject = true;
    updateK8sResourcesFromCluster();
    updateK8sResourcesFromWorkspace();
    updateK8sResourcesFromKustomize();
  };

  console.log("Kubernetes Reference Highlighter activated");
}

export function getAllFileNamesInDirectory(dirPath: string) {
  const fs = require("fs");
  const path = require("path");

  let files: string[] = [];

  function walkSync(dir: string, fileList: string[]) {
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
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

export function createDiagnostic(
  start: number,
  end: number,
  text: string,
  message: string,
  level: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Information
): vscode.Diagnostic {
  const pos1 = indexToPosition(text, start);
  const pos2 = indexToPosition(text, end);
  const range = new vscode.Range(pos1, pos2);
  const diagnostic = new vscode.Diagnostic(range, message, level);
  return diagnostic;
}

function generateMessage(
  type: string,
  name: string,
  activeFilePath: string,
  fromWhere?: FromWhere
) {
  const p = require("path");
  let message = "";
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message = `Found ${type}, ${name}, in ${fromWhere}`;
    } else {
      const fromFilePath = fromWhere.path;
      const relativeFilePathFromRoot = vscode.workspace.asRelativePath(
        fromFilePath || ""
      );
      const activeDirPath: string = p.dirname(activeFilePath || "");
      const relativePathFromActive: string = p.relative(
        activeDirPath || "",
        fromFilePath
      );
      const path =
        relativeFilePathFromRoot.length < relativePathFromActive.length
          ? "/" + relativeFilePathFromRoot
          : relativePathFromActive.includes("/")
          ? relativePathFromActive
          : "./" + relativePathFromActive;
      message = `Found ${type}, ${name}, in ${fromWhere.place} at ${path}`;
    }
  } else {
    message = `Found ${type}, ${name}`;
  }
  return message;
}

function indexToPosition(text: string, index: number): vscode.Position {
  const lines = text.substring(0, index).split(/\r?\n/);
  const line = lines.length - 1;
  const character = lines[line].length;
  return new vscode.Position(line, character);
}

export function textToK8sResource(text: string): K8sResource {
  const YAML = require("yaml");
  const yml = YAML.parse(text);
  return {
    kind: yml.kind,
    metadata: {
      name: yml.metadata?.name,
      namespace: yml.metadata?.namespace,
    },
  };
}

// this method is called when your extension is deactivated
export function deactivate() {}
