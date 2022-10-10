// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as crawlers from "./resource_crawlers";
import * as finders from "./finders";

import { FromWhere, K8sResource } from "./types";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "k8s-checker" is now active!');

  const k8s = require("@kubernetes/client-node");
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let kubeResourcesKustomize: K8sResource[] = [];
  let enableWorkSpaceCrawling = true;
  let enableWorkSpaceKustomizeCrawling = crawlers.isKustomizeInstalled();
  let enableClusterCrawling = true;

  const enableWorkSpaceCrawlingCommand = vscode.commands.registerCommand(
    "k8s-checker.enableWorkSpaceCrawling",
    () => {
      enableWorkSpaceCrawling = !enableWorkSpaceCrawling;
      vscode.window.showInformationMessage(
        `WorkSpaceCrawling: ${enableWorkSpaceCrawling ? "Enabled" : "Disabled"}`
      );
      if (enableWorkSpaceCrawling) {
        updateK8sResourcesFromWorkspace();
      } else {
        kubeResourcesWorkspace = [];
      }
    }
  );

  const enableClusterCrawlingCommand = vscode.commands.registerCommand(
    "k8s-checker.enableClusterCrawling",
    () => {
      enableClusterCrawling = !enableClusterCrawling;
      vscode.window.showInformationMessage(
        `Cluster Crawling: ${enableClusterCrawling ? "Enabled" : "Disabled"}`
      );
      if (enableClusterCrawling) {
        updateK8sResourcesFromCluster();
      } else {
        kubeResourcesCluster = [];
      }
    }
  );

  const enableKustomizeCrawlingCommand = vscode.commands.registerCommand(
    "k8s-checker.enableKustomizeCrawling",
    () => {
      if (!crawlers.isKustomizeInstalled()) {
        vscode.window.showErrorMessage(
          "Kustomize is not installed. Please install it first."
        );
        return;
      }
      enableWorkSpaceKustomizeCrawling = !enableWorkSpaceKustomizeCrawling;
      vscode.window.showInformationMessage(
        `Kustomize Crawling: ${
          enableWorkSpaceKustomizeCrawling ? "Enabled" : "Disabled"
        }`
      );
      if (enableWorkSpaceKustomizeCrawling) {
        updateK8sResourcesFromKustomize();
      } else {
        kubeResourcesKustomize = [];
      }
    }
  );

  const updateK8sResourcesFromWorkspace = () => {
    if (!enableWorkSpaceCrawling) {
      return;
    }
    kubeResourcesWorkspace = crawlers.getK8sResourceNamesInWorkspace();
  };

  const updateK8sResourcesFromCluster = () => {
    if (!enableClusterCrawling) {
      return;
    }
    kubeResourcesCluster = crawlers.getClusterResources(k8sApi);
  };

  const updateK8sResourcesFromKustomize = () => {
    if (!enableWorkSpaceKustomizeCrawling) {
      return;
    }
    kubeResourcesKustomize = crawlers.getKustomizeResources();
  };

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("k8s-checker");

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

    const diagnosticsCombined = fileTextSplitted.flatMap((yamlFile) => {
      let thisResource: K8sResource;

      try {
        thisResource = textToK8sResource(yamlFile);
      } catch (e) {
        currentIndex += yamlFile.length + split.length;
        return [];
      }

      firstTimeK8sObjectFound(); // first time finding a k8s object

      const diagnosticServices = finders.findServices(
        kubeResources,
        thisResource,
        yamlFile
      );
      const diagnosticValueFrom = finders.findValueFromKeyRef(
        kubeResources,
        thisResource,
        yamlFile
      );
      const diagnosticIngress = finders.findIngressService(
        kubeResources,
        thisResource,
        yamlFile
      );
      const highlights = [
        ...diagnosticServices,
        ...diagnosticValueFrom,
        ...diagnosticIngress,
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

      currentIndex += yamlFile.length + split.length;
      return diagnostics;
    });

    diagnosticCollection.set(doc.uri, diagnosticsCombined);
  };

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!foundFirstK8sObject) {
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
    enableClusterCrawlingCommand,
    enableWorkSpaceCrawlingCommand,
    enableKustomizeCrawlingCommand,
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
      "k8s-checker found a k8s object in your workspace. It will now start to crawl your cluster for more objects."
    );
    foundFirstK8sObject = true;
    updateK8sResourcesFromCluster();
    updateK8sResourcesFromWorkspace();
    updateK8sResourcesFromKustomize();
  };

  console.log("k8s-checker activated");
}

function createDiagnostic(
  start: number,
  end: number,
  text: string,
  message: string
) {
  const pos1 = indexToPosition(text, start);
  const pos2 = indexToPosition(text, end);
  const range = new vscode.Range(pos1, pos2);
  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    vscode.DiagnosticSeverity.Information
  );
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
      name: yml.metadata.name,
      namespace: yml.metadata.namespace,
    },
  };
}

// this method is called when your extension is deactivated
export function deactivate() {}
