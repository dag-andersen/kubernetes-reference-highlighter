// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

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
  let services: [string, string][] = [];

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "k8s-checker.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from k8s-checker!");
    }
  );

  context.subscriptions.push(disposable);

  // watch for saves to the current file
  let disposable2 = vscode.workspace.onDidSaveTextDocument((event) => {
    console.log("file saved");

    k8sApi.listServiceForAllNamespaces().then((res) => {
      let s = res.body.items;
      services = s.map((service) => {
        return [service.metadata.namespace, service.metadata.name];
      });
      console.log(services);
      console.log("service name list updated");
    });

  });
  context.subscriptions.push(disposable2);

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("k8s-checker");

  const handle = (doc: vscode.TextDocument) => {
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
        namespace === service[0] ? service[1] : `${service[1]}.${service[0]}`;
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

  const didSave = vscode.workspace.onDidChangeTextDocument((event) => {
    handle(event.document);
  });

  context.subscriptions.push(diagnosticCollection, didSave);
}

// get all kubernetes resource names in folder and subfolders
function getK8sResourceNames(folder: vscode.WorkspaceFolder) {
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

  files = walkSync(folder.uri.fsPath, files);

  const YAML = require("yaml");

  let resourceNames: string[] = [];

  files.forEach((file) => {
    const fileText = fs.readFileSync(file, "utf8");
    const yml = YAML.parse(fileText);
    const name = yml.metadata.name;
    resourceNames.push(name);
  });
  
  return resourceNames;
}


// this method is called when your extension is deactivated
export function deactivate() {}
