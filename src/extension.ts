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
  let kubeResources: K8sResource[] = [];

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
    const res = getK8sResourceNamesInWorkspace();
    kubeResources.push(...res);
    console.log(`resources: ${res}`);
    console.log(`services names: ${kubeResources.map((s) => s.metadata.name)}`);
  });

  // create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("k8s-checker");

  const updateK8sResources = () => {
    let resources: K8sResource[] = [];
    k8sApi.listServiceForAllNamespaces().then((res) => {
      let s = res.body.items;
      resources.push(
        ...s.map((service) => {
          return {
            kind: "Service",
            metadata: {
              name: service.metadata.name,
              namespace: service.metadata.namespace,
            },
          };
        })
      );
      console.log(resources);
      console.log("service name list updated");
    });
    k8sApi.listSecretForAllNamespaces().then((res) => {
      let s = res.body.items;
      resources.push(
        ...s.map((service) => {
          return {
            kind: "Secret",
            metadata: {
              name: service.metadata.name,
              namespace: service.metadata.namespace,
            },
          };
        })
      );
      console.log(resources);
      console.log("secrets with name updated");
    });
    kubeResources = resources;
  };

  const updateDiagnostics = (doc: vscode.TextDocument) => {
    kubeResources.forEach((r) => {
      console.log(`kind: ${r.kind}, name: ${r.metadata.name}`);
    });
    const fileText = doc.getText();

    const thisResource = textToK8sResource(fileText);

    console.log(`namespace: ${thisResource.metadata.namespace}`);

    const diagnosticServices = findServices(
      kubeResources,
      thisResource,
      fileText
    );
    
    const diagnosticSecret = findSecret(kubeResources, thisResource, fileText);
    
    const diagnostics = [...diagnosticServices, ...diagnosticSecret];

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

function findServices(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  resources
    .filter((r) => r.kind === "Service")
    .forEach((service) => {
      const serviceName =
        thisResource.metadata.namespace === service.metadata.namespace
          ? service.metadata.name
          : `${service.metadata.name}.${service.metadata.namespace}`;
      console.log(`service name: ${serviceName}`);

      // regex find all instances of service name
      const regex = new RegExp(serviceName, "g");
      const matches = text.match(regex);
      if (matches) {
        console.log(`found ${matches.length} matches`);
        matches.forEach((match) => {
          const start = text.indexOf(match);
          const end = start + match.length;
          console.log(`start: ${start}, end: ${end}`);
          // get column and line number from index
          const pos1 = indexToPosition(text, start);
          const pos2 = indexToPosition(text, end);
          console.log(`pos1 line: ${pos1.line}, pos1 char: ${pos1.character}`);
          console.log(`pos2 line: ${pos2.line}, pos2 char: ${pos2.character}`);
          const range = new vscode.Range(pos1, pos2);
          const diagnostic = new vscode.Diagnostic(
            range,
            `found service ${serviceName}`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostics.push(diagnostic);
        });
      }
    });

  return diagnostics;
}

function findSecret(
  resources: K8sResource[],
  thisResource: K8sResource,
  text: string
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  console.log("finding secrets");

  resources
    .filter((r) => r.kind === "Secret")
    .forEach((service) => {
      const secretName =
        thisResource.metadata.namespace === service.metadata.namespace
          ? service.metadata.name
          : `${service.metadata.name}.${service.metadata.namespace}`;
      console.log(`Secret name: ${secretName}`);

      // regex find all instances of
      // valueFrom:
      //   secretKeyRef:
      const regex =
        /valueFrom:\s*secretKeyRef:\s*name:\s*([a-zA-Z]+)\s*key:\s*([a-zA-Z]+)/gm;
      const matches = text.matchAll(regex);
      for (const match of matches) {
        console.log(match);
        console.log(match.index);

        const secretName = match[1];

        if (secretName === service.metadata.name) {
          console.log(`found secret ${secretName}`);
          const start = match.index || 0;
          const end = start + match[0].length;
          console.log(`start: ${start}, end: ${end}`);
          // get column and line number from index
          const pos1 = indexToPosition(text, start);
          const pos2 = indexToPosition(text, end);
          console.log(`pos1 line: ${pos1.line}, pos1 char: ${pos1.character}`);
          console.log(`pos2 line: ${pos2.line}, pos2 char: ${pos2.character}`);
          const range = new vscode.Range(pos1, pos2);
          const diagnostic = new vscode.Diagnostic(
            range,
            `found secret ${secretName}`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostics.push(diagnostic);
        }
      }
    });

  return diagnostics;
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
    const fileText = fs.readFileSync(file, "utf8");
    try {
      resources.push(textToK8sResource(fileText));
    } catch (e) {}
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
