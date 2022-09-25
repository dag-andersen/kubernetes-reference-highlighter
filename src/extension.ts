// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// define basic type
type K8sResource = {
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
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
  let services: K8sResource[] = [];

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const helloWorld = vscode.commands.registerCommand(
    "k8s-checker.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from k8s-checker!");
    }
  );

  // watch for saves to the current file
  const onSave = vscode.workspace.onDidSaveTextDocument((event) => {
    updateK8sResources();
    const resources = getK8sResourceNames(vscode.workspace.workspaceFolders[0]);
    services.push(...resources);
    console.log(`resources: ${resources}`);
    console.log(`services: ${services}`);
  });

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("k8s-checker");

  const updateK8sResources = () => {
    k8sApi.listServiceForAllNamespaces().then((res) => {
      let s = res.body.items;
      services = s.map((service) => {
        return {
          kind: service.kind,
          metadata: {
            name: service.metadata.name,
            namespace: service.metadata.namespace,
          },
        };
      });
      console.log(services);
      console.log("service name list updated");
    });
  };

  const updateDiagnostics = (doc: vscode.TextDocument) => {
    const fileText = doc.getText();

    const YAML = require("yaml");

    const yml = YAML.parse(fileText);
    console.log(yml);
    const namespace = yml.metadata.namespace || "default";
    console.log(`namespace: ${namespace}`);

    const diagnostics: vscode.Diagnostic[] = [];

    for (var i = 0; i < services.length; i++) {
      const service = services[i];
      const serviceName =
        namespace === service.metadata.namespace
          ? service.metadata.name
          : `${service.metadata.name}.${service.metadata.namespace}`;
      console.log(`service name: ${serviceName}`);
      let lines = fileText.split(/\r?\n/);
      for (var j = 0; j < lines.length; j++) {
        let line = lines[j];
        const index = line.indexOf(serviceName);
        if (index > -1) {
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(
                new vscode.Position(j, index),
                new vscode.Position(j, index + serviceName.length)
              ),
              "This service exists in the cluster",
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }

    diagnosticCollection.set(doc.uri, diagnostics);
  };

  const onChange = vscode.workspace.onDidChangeTextDocument((event) => {
    updateDiagnostics(event.document);
  });

  const hi = vscode.languages.registerInlineValuesProvider("yml", {
    provideInlineValues(document, range, context, token) {
      const something = new vscode.InlineValueText(
        new vscode.Range(new vscode.Position(1, 5), new vscode.Position(1, 10)),
        "hello world"
      );
      console.log("hi");
      return [something];
    },
  });

  context.subscriptions.push(
    helloWorld,
    onSave,
    diagnosticCollection,
    onChange,
    hi
  );
}

// get all kubernetes resource names in folder and subfolders
function getK8sResourceNames(folder: vscode.WorkspaceFolder): K8sResource[] {
  const fs = require("fs");
  const path = require("path");

  let files: string[] = [];

  function walkSync(dir: string, filelist: string[]) {
    const files = fs.readdirSync(dir);
    files.forEach(function (file: string) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        filelist = walkSync(path.join(dir, file), filelist);
      } else {
        filelist.push(path.join(dir, file));
      }
    });

    
    return filelist;
  }
  
  files = walkSync(folder.uri.fsPath, files).filter((file: string) => {
    return file.endsWith(".yml") || file.endsWith(".yaml");
  });
  
  files.forEach((file) => {
    console.log(`file: ${file}`);
  });

  console.log(files);

  const YAML = require("yaml");

  const resources: K8sResource[] = [];

  files.forEach((file) => {
    const fileText = fs.readFileSync(file, "utf8");
    const yml = YAML.parse(fileText);
    try {
      resources.push({
        kind: yml.kind,
        metadata: {
          name: yml.metadata.name,
          namespace: yml.metadata.namespace,
        },
      });
    } catch (e) { }
  });

    resources.forEach((r) => {
      console.log(`file: ${r.metadata.name}`);
    });

  return resources;
}

// this method is called when your extension is deactivated
export function deactivate() {}
