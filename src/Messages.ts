import * as vscode from "vscode";
import { FromWhere, Local } from "./types";

type DefaultMessage = {
  content: string;
};

export type Message =
  | SubItemNotFound
  | ReferenceNotFound
  | ReferenceFound
  | SubItemFound
  | DefaultMessage;

export function generateMessage(mg: Message[]): string {
  if (mg.every((m) => "type" in m)) {
    return generateFoundMessage(mg as ReferenceFound[]);
  } else if (mg.every((m) => "suggestion" in m && "subType" in m)) {
    return generateSubItemNotFoundMessage(mg as SubItemNotFound[]);
  } else if (mg.every((m) => "suggestion" in m)) {
    return generateNotFoundMessage(mg as ReferenceNotFound[]);
  } else if (mg.every((m) => "subType" in m)) {
    return generateSubItemFoundMessage(mg as SubItemFound[]);
  }
  let mes = mg as DefaultMessage[];
  return mes.reduce((acc, m) => acc + m.content + "\\\n", "");
}

type ReferenceFound = {
  type: string;
  name: string;
  pwd: string;
  fromWhere?: FromWhere;
};

function generateFoundMessage(mg: ReferenceFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { type, name, pwd, fromWhere } = mg[0];
    let message = `✅ Found ${type}: \`${name}\``;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` in ${fromWhere}`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? ` in ${link(fromWhere, pwd)}`
            : ` with ${fromWhere.place} at ${link(fromWhere, pwd)}`;
      }
    }
    return message;
  }

  const type = mg[0].type;
  const name = mg[0].name;

  let message = `✅ Found ${type}: \`${name}\``;
  mg.forEach((mg, i) => {
    if (i === 0) {
      message += " in:";
    }
    message += "\n";
    const { pwd, fromWhere } = mg;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += `- ${fromWhere}`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? `- ${link(fromWhere, pwd)}`
            : `- ${link(fromWhere, pwd)} with ${fromWhere.place}`;
      }
    }
  });
  return message;
}

type ReferenceNotFound = {
  name: string;
  suggestion: string;
  pwd: string;
  fromWhere?: FromWhere;
};

function generateNotFoundMessage(mg: ReferenceNotFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }

  if (mg.length === 1) {
    const { name, pwd, fromWhere, suggestion } = mg[0];
    let message = `🤷‍♂️ \`${name}\` not found. Did you mean \`${suggestion}\`?`;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` (found in ${fromWhere})`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? ` (in ${link(fromWhere, pwd)})`
            : ` (with ${fromWhere.place} at ${link(fromWhere, pwd)})`;
      }
    }
    return message;
  }

  const { name } = mg[0];
  let message = `🤷‍♂️ \`${name}\` not found.`;
  mg.forEach((mg, i) => {
    message += "\n";
    const { pwd, fromWhere, suggestion } = mg;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += `- Did you mean \`${suggestion}\`? (found in ${fromWhere})`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? `- Did you mean \`${suggestion}\`? (from ${link(fromWhere, pwd)})`
            : `- Did you mean \`${suggestion}\`? (from ${link(fromWhere, pwd)} with ${fromWhere.place})`;
      }
    }
  });
  return message;
}

type SubItemFound = {
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  pwd: string;
  fromWhere?: FromWhere;
};
function generateSubItemFoundMessage(mg: SubItemFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { subType, mainType, subName, mainName, pwd, fromWhere } = mg[0];
    let message = `✅ Found ${subType}: \`${subName}\` in ${mainType}: \`${mainName}\``;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` at ${fromWhere}`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? ` in ${link(fromWhere, pwd)}`
            : ` with ${fromWhere.place} at ${link(fromWhere, pwd)}`;
      }
    }
    return message;
  }

  const { subType, mainType, subName, mainName } = mg[0];

  let message = `✅ Found ${subType}: \`${subName}\` in ${mainType}: \`${mainName}\``;
  mg.forEach((mg, i) => {
    if (i === 0) {
      message += " in:";
    }
    message += "\n";
    const { pwd, fromWhere } = mg;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += `- ${fromWhere}`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? `- ${link(fromWhere, pwd)}`
            : `- ${link(fromWhere, pwd)} with ${fromWhere.place}`;
      }
    }
  });
  return message;
}

type SubItemNotFound = {
  subType: string;
  mainType: string;
  subName: string;
  mainName: string;
  suggestion: string;
  pwd: string;
  fromWhere?: FromWhere;
};

function generateSubItemNotFoundMessage(mg: SubItemNotFound[]): string {
  if (mg.length === 0) {
    return "Error";
  }
  if (mg.length === 1) {
    const { subType, pwd, subName, mainType, fromWhere, suggestion, mainName } = mg[0];
    let message = `🤷‍♂️ _${subType}_: \`${subName}\` not found in _${mainType}_: \`${mainName}\``;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += ` (in ${fromWhere})`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? ` (in ${link(fromWhere, pwd)})`
            : ` (with ${fromWhere.place} at ${link(fromWhere, pwd)})`;
      }
    }
    return message + `.\\\nDid you mean \`${suggestion}\`?`;
  }

  const { subType, subName, mainType, mainName } = mg[0];
  let message = `🤷‍♂️ _${subType}_: \`${subName}\` not found`;
  mg.forEach((mg, i) => {
    if (i === 0) {
      message += " in:";
    }
    message += "\n";
    const { pwd, fromWhere, suggestion } = mg;
    if (fromWhere) {
      if (typeof fromWhere === "string") {
        message += `- _${mainType}_: \`${mainName}\ from ${fromWhere}`;
      } else {
        message +=
          fromWhere.place === "workspace"
            ? `- _${mainType}_: \`${mainName}\` from ${link(fromWhere, pwd)})`
            : `- _${mainType}_: \`${mainName}\` from ${link(fromWhere, pwd)} with ${fromWhere.place}`;
      }
    }
    message += `.\\\nDid you mean \`${suggestion}\`?`;
  });
  return message;
}

function getRelativePath(path: string, pwd: string): string {
  const p = require("path");
  const fromFilePath = path;
  const relativeFilePathFromRoot = vscode.workspace.asRelativePath(
    fromFilePath || ""
  );
  const activeDirPath: string = p.dirname(pwd || "");
  const relativePathFromActive: string = p.relative(
    activeDirPath || "",
    fromFilePath
  );
  return relativeFilePathFromRoot.length < relativePathFromActive.length
    ? "/" + relativeFilePathFromRoot
    : relativePathFromActive.includes("/")
    ? relativePathFromActive
    : "./" + relativePathFromActive;
}

function link(local: Local, pwd: string): string {
  const { place, path } = local;

  if (place === "kustomize" || place === "helm") {
    const folder = path.substring(0, path.lastIndexOf("/"));
    const relativePath = getRelativePath(folder, pwd);
    return `[\`${relativePath}\`](${path})`;
  }

  const relativePath = getRelativePath(path, pwd);
  return `[\`${relativePath}\`](${path})`;
}
