// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

type FromWhere = "workspace" | "cluster";

type Highlight = [
  start: number,
  end: number,
  text: string,
  type: string,
  name: string
];

// define basic type
type K8sResource = {
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
  where?: FromWhere;
};

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
  let kubeResources: K8sResource[] = [];
  let enableWorkSpaceCrawling = false;
  let enableClusterCrawling = false;

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const enableWorkSpaceCrawlingCommand = vscode.commands.registerCommand(
    "k8s-checker.enableWorkSpaceCrawling",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      enableWorkSpaceCrawling = true;
      vscode.window.showInformationMessage("enableWorkSpaceCrawling");
      updateK8sResourceFromWorkspace();
    }
  );

  const enableClusterCrawlingCommand = vscode.commands.registerCommand(
    "k8s-checker.enableClusterCrawling",
    () => {
      enableClusterCrawling = true;
      vscode.window.showInformationMessage("enableClusterCrawling");
      updateK8sResourceFromWorkspace();
    }
  );

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("k8s-checker");

  const updateK8sResourceFromWorkspace = () => {
    if (!enableWorkSpaceCrawling) {
      return;
    }
    const res = getK8sResourceNamesInWorkspace();
    kubeResources.push(...res);
    console.log(`resources: ${res}`);
    console.log(
      `kubeResources names: ${kubeResources.map((s) => s.metadata.name)}`
    );
  };

  const updateK8sResourcesFromCluster = () => {
    if (!enableClusterCrawling) {
      return;
    }

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
    kubeResources = resources;
  };

  let lastDocument = "";

  const updateDiagnostics = (doc: vscode.TextDocument) => {
    kubeResources.forEach((r) => {
      console.log(`kind: ${r.kind}, name: ${r.metadata.name}`);
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

    fileTextSplitted.forEach((yamlFile) => {
      const thisResource = textToK8sResource(yamlFile);
      console.log(`namespace: ${thisResource.metadata.namespace}`);

      const diagnosticServices = findServices(
        kubeResources,
        thisResource,
        yamlFile
      );

      const diagnosticValueFrom = findValueFromKeyRef(
        kubeResources,
        thisResource,
        yamlFile
      );
      const diagnosticIngress = findIngressService(
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
          h[4]
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
    updateK8sResourceFromWorkspace();
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
}

function findServices(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  const highlights: Highlight[] = [];

  if (thisResource.kind === "Ingress" || thisResource.kind === "Service") {
    return highlights;
  }

  const refType = "Service";

  resources
    .filter((r) => r.kind === refType)
    .forEach((r) => {
      const name =
        thisResource.metadata.namespace === r.metadata.namespace
          ? r.metadata.name
          : `${r.metadata.name}.${r.metadata.namespace}`;
      console.log(`service name: ${name}`);

      const regex = new RegExp(name, "g");
      const matches = text.matchAll(regex);

      for (const match of matches) {
        console.log(match);
        console.log(match.index);
        const start = match.index || 0;
        const end = start + name.length;
        console.log(`start: ${start}, end: ${end}`);
        // get column and line number from index
        highlights.push([start, end, text, refType, name]);
      }
    });

  return highlights;
}

function findValueFromKeyRef(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  const highlights: Highlight[] = [];

  if (thisResource.kind !== "Deployment") {
    return highlights;
  }

  console.log("finding secrets");

  const regex =
    /valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))/gm;
    //valueFrom:\s*([a-zA-Z]+)KeyRef:\s*([a-zA-Z]+):\s*([a-zA-Z-]+)\s*([a-zA-Z]+):\s*([a-zA-Z-]+)/gm;
    //valueFrom:\s*([a-zA-Z]+)KeyRef:\s*(?:key:\s*[a-zA-Z-]+|name:\s*([a-zA-Z-]+))\s*([a-zA-Z]+):\s*([a-zA-Z-]+)/gm;

  const matches = text.matchAll(regex);

  for (const match of matches) {
    console.log(match);
    console.log(match.index);

    let refType = "";
    switch (match[1]) {
      case "secret":
        refType = "Secret";
        break;
      case "configMap":
        refType = "ConfigMap";
        break;
      default:
        continue;
    }

    let name = match[2] || match[3];
    console.log(`name: ${name}`);

    resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
      .filter((r) => r.metadata.name === name)
      .forEach((r) => {
        console.log(`found ${r.kind} name: ${name}`);
        const shift = match[0].indexOf(name);
        const start = (match.index || 0) + shift;
        const end = start + name.length;
        highlights.push([start, end, text, refType, name]);
      });
  }

  return highlights;
}

function findIngressService(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): Highlight[] {
  const highlights: Highlight[] = [];

  if (thisResource.kind !== "Ingress") {
    return highlights;
  }

  console.log("finding secrets");

  const regex =
    /service:\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))\s*(?:name:\s*([a-zA-Z-]+)|port:\s*[a-zA-Z]+:\s*(?:\d+|[a-zA-Z]+))/gm;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    console.log(match);
    console.log(match.index);

    let refType = "Service";
    let name = match[1] || match[2];

    resources
      .filter((r) => r.kind === refType)
      .filter((r) => r.metadata.namespace === thisResource.metadata.namespace)
      .filter((r) => r.metadata.name === name)
      .forEach((r) => {
        console.log(`found ${r.kind} name: ${name}`);
        const shift = match[0].indexOf(name);
        const start = (match.index || 0) + shift;
        const end = start + name.length;
        highlights.push([start, end, text, refType, name]);
      });
  }

  return highlights;
}

function createDiagnostic(
  start: number,
  end: number,
  text: string,
  type: string,
  name: string
) {
  console.log(`start: ${start}, end: ${end}`);
  const pos1 = indexToPosition(text, start);
  const pos2 = indexToPosition(text, end);
  console.log(`pos1 line: ${pos1.line}, pos1 char: ${pos1.character}`);
  console.log(`pos2 line: ${pos2.line}, pos2 char: ${pos2.character}`);
  const range = new vscode.Range(pos1, pos2);
  const diagnostic = new vscode.Diagnostic(
    range,
    `Found ${type}: ${name}`,
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

// get all kubernetes resource names in folder and subfolders
function getK8sResourceNamesInWorkspace(): K8sResource[] {
  const fs = require("fs");

  const files = getAllFileNamesInDirectory(
    vscode.workspace.workspaceFolders[0].uri.fsPath
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
        resources.push(textToK8sResource(text));
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

function textToK8sResource(text: string): K8sResource {
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
