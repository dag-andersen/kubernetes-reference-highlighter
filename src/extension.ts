// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {
  getK8sResourceNamesInWorkspace,
  getClusterResources,
} from "./resource_crawlers";
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

  //decalre tuple
  let kubeResourcesCluster: K8sResource[] = [];
  let kubeResourcesWorkspace: K8sResource[] = [];
  let enableWorkSpaceCrawling = true;
  let enableClusterCrawling = true;

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const enableWorkSpaceCrawlingCommand = vscode.commands.registerCommand(
    "k8s-checker.enableWorkSpaceCrawling",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      enableWorkSpaceCrawling = !enableWorkSpaceCrawling;
      vscode.window.showInformationMessage("enableWorkSpaceCrawling");
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
      vscode.window.showInformationMessage("enableClusterCrawling");
      if (enableClusterCrawling) {
        updateK8sResourcesFromCluster();
      } else {
        kubeResourcesCluster = [];
      }
    }
  );

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("k8s-checker");

  const updateK8sResourcesFromWorkspace = () => {
    if (!enableWorkSpaceCrawling) {
      return;
    }
    const res = getK8sResourceNamesInWorkspace();
    kubeResourcesWorkspace = res;
    console.log(`resources: ${res}`);
    console.log(
      `kubeResources names: ${kubeResourcesWorkspace.map(
        (s) => s.metadata.name
      )}`
    );
  };

  const updateK8sResourcesFromCluster = () => {
    if (!enableClusterCrawling) {
      return;
    }

    kubeResourcesCluster = getClusterResources(k8sApi);
  };

  let lastDocument = "";

  const updateDiagnostics = (doc: vscode.TextDocument) => {
    kubeResourcesCluster.forEach((r) => {
      console.log(`kind: ${r.kind}, name: ${r.metadata.name}, from cluster`);
    });
    kubeResourcesWorkspace.forEach((r) => {
      console.log(`kind: ${r.kind}, name: ${r.metadata.name}, from workspace`);
    });
    const fileText = doc.getText();
    if (fileText === lastDocument) {
      return;
    }
    lastDocument = fileText;

    const split = "---";

    const fileTextSplitted = fileText.split(split);

    let currentIndex = 0;
    const diagnosticsCombined: vscode.Diagnostic[] = [];

    const kubeResources = [...kubeResourcesCluster, ...kubeResourcesWorkspace];

    fileTextSplitted.forEach((yamlFile) => {
      const thisResource = textToK8sResource(yamlFile);
      console.log(`namespace: ${thisResource.metadata.namespace}`);

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
        return createDiagnostic(
          h[0] + currentIndex,
          h[1] + currentIndex,
          fileText,
          h[3],
          h[4],
          h[5]
        );
      });

      diagnosticsCombined.push(...diagnostics);

      currentIndex += yamlFile.length + split.length;
    });

    diagnosticCollection.set(doc.uri, diagnosticsCombined);
  };

  // watch for saves to the current file
  const onSave = vscode.workspace.onDidSaveTextDocument((event) => {
    updateK8sResourcesFromCluster();
    updateK8sResourcesFromWorkspace();
  });

  const onChange = vscode.workspace.onDidChangeTextDocument((event) => {
    updateDiagnostics(event.document);
  });

  const onOpen = vscode.workspace.onDidOpenTextDocument(updateDiagnostics);

  context.subscriptions.push(
    enableWorkSpaceCrawlingCommand,
    enableClusterCrawlingCommand,
    onSave,
    diagnosticCollection,
    onChange,
    onOpen
  );

  updateK8sResourcesFromCluster();
  updateK8sResourcesFromWorkspace();

  console.log("k8s-checker activated");
}

function createDiagnostic(
  start: number,
  end: number,
  text: string,
  type: string,
  name: string,
  fromWhere?: FromWhere
) {
  console.log(`start: ${start}, end: ${end}`);
  const pos1 = indexToPosition(text, start);
  const pos2 = indexToPosition(text, end);
  console.log(`pos1 line: ${pos1.line}, pos1 char: ${pos1.character}`);
  console.log(`pos2 line: ${pos2.line}, pos2 char: ${pos2.character}`);
  const range = new vscode.Range(pos1, pos2);
  const message = fromWhere
    ? `Found ${type}, ${name}, in ${fromWhere}`
    : `Found ${type}: ${name}`;
  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    vscode.DiagnosticSeverity.Warning
  );
  return diagnostic;
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
