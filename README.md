# <img src="/images/icon.png" width="70" /> Kubernetes Reference Highlighter

## Notes

- If you have [kustomize](https://kustomize.io/) installed as a stand-alone binary in your PATH, the extension will use `kustomize build` instead of `kubectl kustomize`.

## Features

### Reference Highlighting  

Currently, the extension only supports scanning of `Services`, `Pods`, `Deployments`, `StatefulSets`, `Jobs`, `CronJobs`, `Secrets`, and `ConfigMaps`. More resources will be added at a later point. 

All resources are namespace-sensitive. A resource will not be highlighted if the resource exists in another namespace.

#### Cluster Scanning

The extension calls the Kubernetes API of your current kube-config and collects all the object-names of the objects you have access to.

<p float="left">
  <img src="/images/deco/cluster-pod.png" width="700" />
</p>


#### Workspace Scanning

The extension will collect all the Kubernetes object's names in the manifest files found in the open VSCode workspace.  

<p float="left">
  <img src="/images/deco/workspace-ingress.png" width="620" />
</p>

#### Kustomize Scanning

The extension will run `kustomize build` on all `kustomization`-files in the open workspace and collect all the Kubernetes object names found in the generated kustomize-output.

<p float="left">
  <img src="/images/deco/kustomize-ingress.png" width="900" />
</p>

#### Helm Scanning

The extension will run `helm template` on all helm charts in the open workspace and collect all the Kubernetes object names found in the generated helm-output.

<p float="left">
  <img src="/images/deco/helm-ingress.png" width="900" />
</p>

### Kustomize Build

The extension will inform you if the kustomize-file builds or not.

<p float="left">
  <img src="/images/deco/kustomize-build-success.png" width="293" />
  <img src="/images/deco/kustomize-build-failed.png" width="300" /> 
</p>

### Helm Template 

The extension will inform you if the helm charts build or not.

<p float="left">
  <img src="/images/deco/helm-build-success.png" width="300" />
  <img src="/images/deco/helm-build-fail.png" width="296" /> 
</p>


## Issues and feature requests 

Please open an issue on GitHub if you experience any issues or have ideas for future features.
