import { Position } from "vscode";
import { Message } from "./decorations/messages";

export type Place = "workspace" | "kustomize" | "helm" | "cluster";

export type FromWhere = {
  place: Place;
  path: string;
};

export type HighLightType = "reference" | "suggestion" | "success" | "error" | "dirty" ;

export type Highlight = {
  position?: Position;
  message: Message;
  type: HighLightType;
  definition: K8sResource;
};

// define basic type
export type K8sResource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels: { [key: string]: string };
  };
  spec?: any;
  data?: any;
  where: FromWhere;
};

export type LookupIncomingReferences = Record<string, IncomingReference[]>;

export type IncomingReference = {
  ref: K8sResource;
  definition: K8sResource;
  message: Message;
};