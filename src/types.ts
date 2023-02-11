import { Message } from "./decorations/messages";

export type FromWhere = Cluster | Local;

export type Cluster = { place: "cluster", context: string };

export type Local = {
  place: "workspace" | "kustomize" | "helm";
  path: string;
};

export type HighLightType = "reference" | "hint" | "success" | "error" ;

export type Highlight = {
  start: number;
  message: Message;
  type: HighLightType;
};

// define basic type
export type K8sResource = {
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
  spec?: any;
  data?: any;
  where: FromWhere;
};
