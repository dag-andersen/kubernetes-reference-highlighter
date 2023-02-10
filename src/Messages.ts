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
      message += ` ${individualRef(fromWhere, pwd)}`;
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
      message += `- ${listRef(fromWhere, pwd)}`;
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
      message += ` (From ${individualRef(fromWhere, pwd)})`;
    }
    return message;
  }

  const { name } = mg[0];
  let message = `🤷‍♂️ \`${name}\` not found.`;
  mg.forEach((mg, i) => {
    message += "\n";
    const { pwd, fromWhere, suggestion } = mg;
    if (fromWhere) {
      message += `- Did you mean \`${suggestion}\`? (From ${listRef(fromWhere, pwd)})`;
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
      message += ` ${individualRef(fromWhere, pwd)}`;
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
      message += `- ${listRef(fromWhere, pwd)}`;
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
      message += ` ${individualRef(fromWhere, pwd)}`;
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
      message += `- _${mainType}_: \`${mainName}\` ${listRef(fromWhere, pwd)}`;
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

function individualRef(fromWhere: FromWhere, pwd: string): string {
  if (typeof fromWhere === "string") {
    return `in ${fromWhere}`;
  }
  const { place, path } = fromWhere;
  if (place === "workspace") {
    return `in ${link(fromWhere, pwd)}`;
  }
  if (place === "helm" || place === "kustomize") {
    return `with _${capitalize(place)}_ at ${link(fromWhere, pwd)}`;
  }
  return "Error";
}

function listRef(fromWhere: FromWhere, pwd: string): string {
  if (typeof fromWhere === "string") {
    return fromWhere;
  }
  const { place } = fromWhere;
  if (place === "kustomize" || place === "helm") {
    return link(fromWhere, pwd) + ` (_${capitalize(fromWhere.place)}_)`;
  }
  return link(fromWhere, pwd);
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
