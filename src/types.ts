import { Message } from "./decorations/messages";

export type FromWhere = {
  place: "workspace" | "kustomize" | "helm" | "cluster";
  path: string;
};

export type HighLightType = "reference" | "hint" | "success" | "error" | "dirty" ;

export type Highlight = {
  start: number;
  message: Message;
  type: HighLightType;
  definition: K8sResource;
};

// define basic type
export type K8sResource = {
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
