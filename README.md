# <img src="/images/icon.png" width="70" /> Kubernetes Reference Highlighter

## Features

### Reference Highlighting  

Each time you save a YAML-file, the extension will update its internal list of Kubernetes objects.

All resources are namespace-sensitive. A resource will not be highlighted if the resource exists in another namespace.

Currently, it only supports scanning of `Services`, `Pods`, `Deployments`, `StatefulSets`, `Jobs`, `CronJobs`, `Secrets`, and `ConfigMaps`. More resources will be added at a later point. 

#### Cluster Scanning

The extension calls the Kubernetes API of your current kube-config and collects all the object-names of the objects you have access to.

<p float="left">
  <img src="/images/ingress-cluster-service.png" width="700" />
</p>


#### Workspace Scanning

The extension will collect all the Kubernetes object's names in the manifest files found in the open VSCode workspace.  

<p float="left">
  <img src="/images/pod-workspace-secret.png" width="620" />
</p>

#### Kustomize Scanning

The extension will run `kustomize build` on all `kustomization`-files in the open workspace and collect all the Kubernetes object names found in the generated kustomize-output.

<p float="left">
  <img src="/images/job-kustomize-serivice.png" width="900" />
</p>

### Kustomize Build

<p float="left">
  <img src="/images/kustomize-success.png" width="300" />
  <img src="/images/kustomize-fail.png" width="290" /> 
</p>

The extension will tell you if the kustomize-file builds or not.

## Notes

- To enable the integration with *kustomize* make sure you have [kustomize installed](https://kustomize.io/), and it is in your PATH.
- I suggest you install the extension [_Error Lens_](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) to easily view the info provided by this extension. 

## Release Notes

### v0.0.2

- Added Kustomize Build Status

### v0.0.1

- Added Cluster Scanning
- Added Workspace Scanning
- Added Kustomize Scanning

## Known Issues

No known issues yet. 

Please open an issue on GitHub if you experience any issues or have ideas for future features.
