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

  var serviceNames: string[] = [];

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

    k8sApi.listNamespacedService("default").then((res) => {
      let services = res.body.items;
      console.log(services);

      serviceNames = services.map((service) => {
        return service.metadata.name;
      });
      console.log(serviceNames);
      console.log("service name list updated");
    });
  });
  context.subscriptions.push(disposable2);

  // watch for changes to the current file
  let disposable3 = vscode.workspace.onDidChangeTextDocument((event) => {
    const yaml = require("js-yaml");
    const fileText = event.document.getText();

    for (var i = 0; i < serviceNames.length; i++) {
      let serviceName = serviceNames[i];
      const index = fileText.indexOf(serviceName);
      if (index > -1) {
        console.log(`${serviceName} has index: ${index}`);
      }
    }

    // try {
    //   const yml = yaml.load(fileText);
    //   console.log(yml);
    // } catch (e) {
    //   console.log(e);
    // }
  });

  context.subscriptions.push(disposable3);
}

// this method is called when your extension is deactivated
export function deactivate() {}
