export type FromWhere = "cluster" | Local;

export type Local = { place: "workspace" | "kustomize"; path: string };

export type Highlight = {
  start: number;
  end: number;
  text: string;
  type: string;
  name: string;
  from?: FromWhere;
};

// define basic type
export type K8sResource = {
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
  where?: FromWhere;
};
