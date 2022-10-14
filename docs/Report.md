<center> Kubernetes Resource Validation </center>

# 1. Abstract

hej med dig

---

- The tool can be found here: https://github.com/dag-andersen/kubernetes-reference-highlighter
- and downloaded here: https://github.com/dag-andersen/kubernetes-reference-highlighter/releases
- or downloaded from the VSCode Marketplace. 

---

# 2. Motivation

Copiled language vs. interpreted languages. 

Static analysis

**Lack of information | external resources**
You may not have all resources locally in the same directory.
That mean we need to look outside boarders of the IDE.

This ofc only works if you have read access to those endpoints/resources from you local machine. If you the endpoints is only visible from inside an enclosed envorihemt this will not work.

Magic strings

Terraform does static "compile" time checks, so you will be notified about your broken references beforehand. 

Kubernetes does not do that. Kubernetes resources are not meant to be created at a specific or in a given order, so we cant talk about a "compile" time. Often in kubernetes your references will not exist on creation time, but will eventually be created.

Since the your texteditor usually does not verify any of the magic strings, it can quite cumbersome to debug the code. It tend to involve manually reading the magic string over and over until you realize that there is spelling mistake, or each resource exists in two different namespaces. No public and free IDE feature or extension exists that checks this. 

This paper will try to see if live verification of magic strings in yaml can reduce the time needed to debug a configuration in kubernetes. A tool will be developed and tested on developers. 10 developers are given a task to debug a system. half of them will do it with the extension enabled and the others wont. The time it takes for each developer will tracked and evaluated upon. 

# 3. Introduction


I will refer to the tool `Kubernetes Reference Highlighter` with KRH


Developers often use tools like `Helm` and `Kustoimze` to template their YAML-files. This is done so multiple configuration can inherent/share common code across different configuration. This means that references that is written directly in the files may not exist in any of the files, but may only be generated on `runtime` when one of the templating tools are used. This makes it much harder to give valuable information to the developer because `object` names are dynamically generated. I have not found any extension that tries to tackle this challenge, so currently developer doesn't get any help validating their YAML-files live while coding. 

## 3.1. Problem formulation
	
- Analyze the existing challenges and issues that can occur when creating resources in Kubernetes
- Describe and analyze existing tools for validating Kubernetes manifests
- Design/implement/evaluate a tool for validating Kubernetes manifests to reduce the number of errors/issues

# 4. Related tools | Existing tools

In this section i will list related tools that aim to help the developer create correct/valid YAML.
- **JetBrains IntelliJ IDEA Kubernetes Plugin**: The full version IntelliJ that includes support for plugins is a paid product and therefore is not accessible publicly. JetBrains' only takes local files into account when highlighting references. The plugin does not check your current cluster or build anything with kustomize like KRH. But JetBrains' plugin comes with extra functionality that lets the user jump between files by clicking the highlighted references (something that KRH does not).
- 


# 5. Prototype | Implementation


## overview

The tools is build as an Visual Studio Code (VSCode) extension, since it is free and is the most popular IDE/Editor in the industry [[source](https://survey.stackoverflow.co/2022/#most-popular-technologies-new-collab-tools)]. The tools i made in typescript, since that is the default for developing VSCode Extensions, since VScode is written in typescript. 

The extension highlights the name of an object if it finds a reference in the open file. The highlighting updates in real time while you type, giving you constant feedback on if your references is found or not.
<p float="left">
  <img src="/readme-images/highlight-workspace-service.png" width="600" />
</p>


Each time you save a YAML-file in VSCode the extension will update its internal list of kubernetes objects.

The extension use Regex and YAML-parsing as the main method for reading the files in the workspace. 

A tool like this is close to useless if the developer can not rely on validity of the feedback it gives. This is why this tool aims to only highlight a string if it is sure that the reference exists. It is better to have false negatives than false positives. 

## Features

### Reference Detection 
As of Version 0.0.2 the extension highlights references to  `Services`, `Deployments`, `Secrets`, and `ConfigMaps`. More resources can easily be added in the future.

All resources are namespace-sensitive. A resource will not be highlighted if the resource exclusively exists in another namespace.

If the string matches with multiple objects the extension will show all the references. e.g the extension will highlight that it found a resource with that name in both the current cluster and in the current editor at the same time. It is now up to the developer to mentally filter which of these piece of information are useful in what he is trying to do. 

### Reference Collection

- **Cluster Scanning**: KRH use the user's current context found in the kube_config to call the Kubernetes Cluster and collects the names of the resources that way.
- **Workspace Scanning**: KRH travers all files ending with `.yml`. or `.yaml` in the current open workspace in VSCode. It collects the `kind`, `name`, and `namespace` of all the Kubernetes objects found in the files.
- **Kustomize Scanning**: KRH travers all files named `kustomization.yml`. or `kustomization.yml` in the current open workspace in VSCode, and builds the kustomize files. All the kubernetes objects generated by `kustomize` is collected. In addition to that the extension will highlight if the file builds or not in kustomization file.
  <p float="left">
  <img src="/readme-images/kustomize-success.png" width="300" />
  <img src="/readme-images/kustomize-fail.png" width="290" /> 
  </p>

Each of these scanning technicques can be disabled through the commandline or through settings. 

# 6. Evaluation

## 6.1. Results

## 6.2. Limitations

# 7. Conclusion

# 8. References