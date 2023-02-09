import { Message } from "./Messages";

export type FromWhere = "cluster" | Local;

export type Local = { place: "workspace" | "kustomize" | "helm"; path: string };

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
  where?: FromWhere;
};
