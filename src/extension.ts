// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as workspace from "./workspace";
import * as cluster from "./cluster";
import * as kustomize from "./kustomize";
import * as helm from "./helm";
import * as finders from "./finders";

import { FromWhere, K8sResource } from "./types";
import { parse } from "yaml";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "Kubernetes Reference Highlighter" is now active!'
  );

  let k8sApi = cluster.getKubeClient();

  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let kubeResourcesKustomize: K8sResource[] = [];
  let kubeResourcesHelm: K8sResource[] = [];

  let enableWorkSpaceScanning = getConfigurationValue("enableWorkSpaceScanning") ?? true;
  let enableKustomizeScanning = getConfigurationValue("enableKustomizeScanning") ?? true;
  let enableHelmScanning = helm.isHelmInstalled() && (getConfigurationValue("enableHelmScanning") ?? true);
  let enableClusterScanning = k8sApi !== undefined && (getConfigurationValue("enableClusterScanning") ?? true);
  let enableCorrectionHints = getConfigurationValue("enableCorrectionHints") ?? false;

  const enableClusterScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableClusterScanning",
    () => {
      if (k8sApi) {
        enableClusterScanning = !enableClusterScanning;
        updateConfigurationKey("enableClusterScanning", enableClusterScanning);
        vscode.window.showInformationMessage(
          `Cluster Scanning: ${enableClusterScanning ? "Enabled" : "Disabled"}`
        );
        updateK8sResourcesFromCluster();
      } else {
        vscode.window.showErrorMessage(`Cluster Scanning: Not available`);
      }
    }
  );

  const enableWorkSpaceScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableWorkSpaceScanning",
    () => {
      enableWorkSpaceScanning = !enableWorkSpaceScanning;
      updateConfigurationKey(
        "enableWorkSpaceScanning",
        enableWorkSpaceScanning
      );
      vscode.window.showInformationMessage(
        `WorkSpace Scanning: ${
          enableWorkSpaceScanning ? "Enabled" : "Disabled"
        }`
      );
      updateK8sResourcesFromWorkspace();
    }
  );

  const enableKustomizeScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableKustomizeScanning",
    () => {
      enableKustomizeScanning = !enableKustomizeScanning;
      updateConfigurationKey(
        "enableKustomizeScanning",
        enableKustomizeScanning
      );
      vscode.window.showInformationMessage(
        `Kustomize Scanning: ${
          enableKustomizeScanning ? "Enabled" : "Disabled"
        }`
      );
      updateK8sResourcesFromKustomize();
    }
  );

  const enableHelmScanningCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableHelmScanning",
    () => {
      if (!helm.isHelmInstalled) {
        vscode.window.showErrorMessage(
          "Helm is not installed. Please install it first."
        );
        return;
      }
      enableHelmScanning = !enableHelmScanning;
      updateConfigurationKey("enableHelmScanning", enableHelmScanning);
      vscode.window.showInformationMessage(
        `Helm Scanning: ${enableHelmScanning ? "Enabled" : "Disabled"}`
      );
      updateK8sResourcesFromHelm;
    }
  );

  const enableCorrectionHintsCommand = vscode.commands.registerCommand(
    "kubernetes-reference-highlighter.enableCorrectionHints",
    () => {
      enableCorrectionHints = !enableCorrectionHints;
      updateConfigurationKey("enableCorrectionHints", enableCorrectionHints);
      vscode.window.showInformationMessage(
        `Reference Correction Hints: ${
          enableCorrectionHints ? "Enabled" : "Disabled"
        }`
      );
    }
  );

  const updateK8sResourcesFromWorkspace = () => {
    if (!enableWorkSpaceScanning) {
      kubeResourcesWorkspace = [];
      return;
    }
    kubeResourcesWorkspace = workspace.getK8sResourceNamesInWorkspace();
  };

  const updateK8sResourcesFromCluster = () => {
    if (!enableClusterScanning) {
      kubeResourcesCluster = [];
      return;
    }
    kubeResourcesCluster = cluster.getClusterResources(k8sApi);
  };

  const updateK8sResourcesFromKustomize = () => {
    if (!enableKustomizeScanning) {
      kubeResourcesKustomize = [];
      return;
    }
    kubeResourcesKustomize = kustomize.getKustomizeResources();
  };

  const updateK8sResourcesFromHelm = () => {
    if (!enableHelmScanning) {
      kubeResourcesHelm = [];
      return;
    }
    kubeResourcesHelm = helm.getHelmResources();
  };

  // create diagnostic collection
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "kubernetes-reference-highlighter"
  );

  let lastDocumentChanged = "";

  const updateDiagnostics = (doc: vscode.TextDocument) => {
    const fileName = doc.fileName;
    if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml")) {
      return;
    }

    const fileText = doc.getText();
    if (fileText === lastDocumentChanged) {
      return;
    }
    lastDocumentChanged = fileText;

    const split = "---";

    const fileTextSplitted = fileText.split(split);

    let currentIndex = 0;

    const kubeResources = [
      ...kubeResourcesHelm,
      ...kubeResourcesKustomize,
      ...kubeResourcesCluster,
      ...kubeResourcesWorkspace,
    ];

    const diagnosticsCombined = fileTextSplitted.flatMap((textSplit) => {
      let thisResource: K8sResource;

      try {
        thisResource = textToK8sResource(textSplit);
      } catch (e) {
        currentIndex += textSplit.length + split.length;
        return [];
      }

      firstTimeK8sObjectFound(); // first time finding a k8s object

      const serviceHighlights = finders.findServices(
        kubeResources,
        thisResource,
        fileName,
        textSplit
      );
      const valueFromHighlights = finders.findValueFromKeyRef(
        kubeResources,
        thisResource,
        fileName,
        textSplit,
        enableCorrectionHints
      );
      const ingressHighlights = finders.findIngressService(
        kubeResources,
        thisResource,
        fileName,
        textSplit,
        enableCorrectionHints
      );
      const highlights = [
        ...serviceHighlights,
        ...valueFromHighlights,
        ...ingressHighlights,
      ];

      let diagnostics = highlights.map((h) => {
        return createDiagnostic(
          h.start + currentIndex,
          h.end + currentIndex,
          fileText,
          h.message,
          h.severity
        );
      });

      if (
        enableKustomizeScanning &&
        (fileName.endsWith("kustomization.yaml") ||
          fileName.endsWith("kustomization.yml"))
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

      if (enableHelmScanning && fileName.endsWith("Chart.yaml")) {
        diagnostics.push(
          ...helm.verifyHelmBuild(
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

  let lastDocumentSaved = "";

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (!foundFirstK8sObject) {
      return;
    }

    if (!doc.fileName.endsWith(".yaml") && !doc.fileName.endsWith(".yml")) {
      return;
    }

    const fileText = doc.getText();
    if (fileText === lastDocumentSaved) {
      return;
    }
    lastDocumentSaved = fileText;

    updateK8sResourcesFromCluster();
    updateK8sResourcesFromWorkspace();
    updateK8sResourcesFromKustomize();
    updateK8sResourcesFromHelm();
    updateDiagnostics(doc);
  });

  const onOpen = vscode.workspace.onDidOpenTextDocument(updateDiagnostics);
  const onChange = vscode.workspace.onDidChangeTextDocument((event) =>
    updateDiagnostics(event.document)
  );

  context.subscriptions.push(
    enableClusterScanningCommand,
    enableWorkSpaceScanningCommand,
    enableKustomizeScanningCommand,
    enableHelmScanningCommand,
    enableCorrectionHintsCommand,
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
    updateK8sResourcesFromHelm();
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
  const range = toRange(text, start, end);
  return new vscode.Diagnostic(range, message, level);
}

export function generateMessage(
  type: string,
  name: string,
  activeFilePath: string,
  fromWhere?: FromWhere
) {
  const p = require("path");
  let message = "";
  if (fromWhere) {
    if (typeof fromWhere === "string") {
      message = `Found ${type} in ${fromWhere}`;
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
      message = `Found ${type} in ${fromWhere.place} at ${path}`;
    }
  } else {
    message = `Found ${type}, ${name}`;
  }
  return message;
}

export function generateNotFoundMessage(
  name: string,
  suggestion: string,
  activeFilePath: string,
  fromWhere?: FromWhere,
) {
  const p = require("path");
  if (fromWhere) {
    if (typeof fromWhere !== "string") {
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
      return `${name} not found. Did you mean ${suggestion}? (in ${fromWhere.place} at ${path})`;
    }
  }
  return `${name} not found. Did you mean ${suggestion}?`;
}

function toRange(text: string, start: number, end: number): vscode.Range {
  const diff = end - start;
  const lines = text.substring(0, end).split(/\r?\n/);
  const endLine = lines.length - 1;
  const endCharacter = lines[endLine].length;

  let currentCharacter = diff;
  let currentLine = endLine;
  while (currentCharacter > 0 && currentLine >= 0) {
    if (lines[currentLine].length < currentCharacter) {
      currentCharacter -= lines[currentLine].length + 1;
      currentLine--;
    } else {
      break;
    }
  }

  const startLine = currentLine;
  const startCharacter = lines[startLine].length - currentCharacter;

  return new vscode.Range(startLine, startCharacter, endLine, endCharacter);
}

export function textToK8sResource(text: string): K8sResource {
  const yml = parse(text);
  return {
    kind: yml.kind,
    spec: yml.spec,
    metadata: {
      name: yml.metadata?.name,
      namespace: yml.metadata?.namespace,
    },
  };
}

// this method is called when your extension is deactivated
export function deactivate() {}

const updateConfigurationKey = (key: string, value: any) =>
  vscode.workspace
    .getConfiguration("kubernetesReferenceHighlighter")
    .update(key, value, true);

const getConfigurationValue = (key: string) =>
  vscode.workspace
    .getConfiguration("kubernetesReferenceHighlighter")
    .get<boolean>(key);

// log message

const diagnosticCollectionTest = vscode.languages.createDiagnosticCollection(
  "kubernetes-reference-highlighter-test"
);

export function logText(text: string) {
  diagnosticCollectionTest.clear();
  const current = vscode.window.activeTextEditor?.document;
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 0),
    text,
    vscode.DiagnosticSeverity.Information
  );
  diagnosticCollectionTest.set(current!.uri, [diagnostic]);
}
