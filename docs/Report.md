<center> Kubernetes Resource Validation </center>

# 1. Abstract

---

- The tool can be found here: https://github.com/dag-andersen/kubernetes-reference-highlighter
- and downloaded here: https://github.com/dag-andersen/kubernetes-reference-highlighter/releases
- or downloaded from the VS Code Marketplace. 

---
# 2. CCS CONCEPTS
- Human-centered computing → Open source software; Software Engineering Tooling → Code Validation

# 3. Keywords
- Open Source Software, IDE Extension, Code Linting, Static code analysis, Code Validation, Kubernetes

# 4. Introduction

<!-- Intro -->

Container Orchestration and Kubernetes are continuously getting more popular during the last couple of years.
Around 25-30% of professional developers use Kubernetes (25.45% [[StackOverflow Survey 2022](https://survey.stackoverflow.co/2022/#section-most-popular-technologies-other-tools)], 30% [[SlashData’s Developer Economics survey](https://developer-economics.cdn.prismic.io/developer-economics/527f60d6-d199-4db8-bd31-6dde43719033_The+State+of+Cloud+Native+Development+March+2022.pdf)], and around one-fourth of the remaining wats to work with Kubernetes in the future [[StackOverflow Survey 2022](https://survey.stackoverflow.co/2022/#most-loved-dreaded-and-wanted-tools-tech-want)]. So we can expect that more and more developers will be deploying and configuring infrastructure on Kubernetes through YAML.

However, Kubernetes is known for being remarkably complex, and the learning curve can be quite steep. In a survey done by StackOverflow 74,75% of the developers who use Kubernetes "loves it" and the remaining 25,25 "dreads it" [[source](https://survey.stackoverflow.co/2022/#section-most-popular-technologies-other-tools)]. Why the ~25% dreads Kubernetes is not specified in the survey, but anything that would lower that percentage is worth striving for. 

<!-- 96% of organizations in 2021 are either using or evaluating Kubernetes [[source](https://www.cncf.io/wp-content/uploads/2022/02/CNCF-AR_FINAL-edits-15.2.21.pdf)].  -->
<!-- A survey conducted by New Relic reports that 88% of IT decision-makers are exploring Kubernetes and Containers [[source](https://newrelic.com/sites/default/files/2021-09/New_Relic_Report%20_2021_Observability_Forecast_Sept.pdf)]. -->
<!-- 9/10 of those who use Kubernetes are profesionals. [[source](https://developer-economics.cdn.prismic.io/developer-economics/527f60d6-d199-4db8-bd31-6dde43719033_The+State+of+Cloud+Native+Development+March+2022.pdf)] -->

The ecosystems around Kubernetes are constantly developing, and it can be difficult to keep up with the newest tools and features. When building workload aimed at running on Kubernetes, most configuration is down in YAML and revolve around Kubernetes Object Definitions. This means we as a community need to ensure we have proper tooling for validating this infrastructure. Both to speed up the development process but also to reduce the number of errors that goes into production. The sooner the bug is found in the software process, the cheaper it is to correct [[source](https://deepsource.io/blog/exponential-cost-of-fixing-bugs/)].

# 5. Problem 

It is very easy to make mistakes when deploying to Kubernetes. There are strict rules of what fields you can add in your Kubernetes Object Definition, but there are no checks that the values provided are valid (besides the fact it needs to be the correct type) - e.g., your _Pod_ can request environments variables from a secret that does not exist, or your `service` can point to Pods that does not exist. 

<!-- Terraform an kubernetes -->
Terraform does static "compile" time checks, so you will be notified about your broken references beforehand. By design, Kubernetes does not do that and can not do that. Kubernetes objects are not expected to be created at the same time or in a given order, so we can not talk about a "compile" time. Kubernetes is managed with Control Planes, and there is no order to when which resource is created/scheduled. In Kubernetes, your references will often not exist on creation time but will only be created at a later point. This explains why there is no static validation by default when creating Kubernetes resources. 

<!-- Yaml -->
Kubernetes object definitions are written in YAML. YAML is a data serialization language that only knows the concepts of primitive data types like arrays, strings, numbers, etc., and therefore does not know the concept of references. All references declared in your Kubernetes objects definition is written as a string, with no type checking or validation. This means there is no built-in reference validation in YAML.

<!-- Linters -->
Since most IDEs, Plugins, or Tools do not verify any of the magic strings, it can be quite cumbersome to debug the code. It tends to involve manually reading the magic string repeatably until you discover that there is a typo or each of your resources exists in two different namespaces and, therefore can't communicate. No public and free IDE feature or extension exist that checks this.

<!-- extended problem: kustomize -->
Furthermore, developers often use tools like _Helm_ and _Kustomize_ to template their YAML-files. This is done so multiple configurations can inherent/share common code across different configurations. This means that references that is hardcoded in the files may not exist in any of the plain files but may only be generated on `runtime` when one of the templating tools is used. This makes it much harder to give valuable information to the developer because Kubernetes objects' names are dynamically generated by the tool. I have not found any extension that tries to tackle this challenge, so currently, developers don't get any assistance validating their YAML-files live while coding when using templating tools like _Helm_ and _Kustomize_. 

<!-- 6% of people think Kustomize and 26% think helm is the way to go [[source](https://juju.is/cloud-native-kubernetes-usage-report-2022#what-is-the-best-way-to-manage-software-on-kubernetes)]. 20% use kustomize and 65% use helm [[source](https://grem1.in/post/k8s-survey-2022-1/)]. -->

In dynamic languages like JavaScript, where there are no _compile time_-checks either, it has been shown that developers use static analysis tools  (or so-called _Linters_) like _ESLint_ to prevent errors. Preventing Errors is said to be the number one reason to use a linter because it catches the bugs early on, so you don't have to spend time debugging it on runtime [[source](https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=8115668&casa_token=xhpJ265RLS8AAAAA:dWnPOr3gek1GJgsxzVQ0PkEiW-NYhkL7VavL2oc4hQN9ILwPCpKpRlPnE0PEQqVk1mkzn0xjPA)]. Linters like _ESLint_ can be integrated with popular IDEs like VS Code or IntelliJ IDEA [[source](https://eslint.org/docs/latest/user-guide/integrations)]. The linter gives the developer continuous feedback on if their code has errors or not. So even though a language does not have static compile time checks, it is still possible to reduce a substantial amount of errors by using Linters running in your IDE. 

<!-- solution -->
Currently, plenty of open-source validation tools exist for Kubernetes Object Definition, but most of them are Command Line tools and do not give continuous feedback live while the developer is coding. Furthermore, the tools only validate the definitions based on the local files provided to the tool and not what is actually running in a Kubernetes Cluster. Most often than not, you only have a subset of the full infrastructure configuration on your local machine, so many of the code references and objects will naturally be broken, and the tools will give incorrect/adequate valuation. So in order to overcome this, we need to look outside the borders of the IDE/current folder. (This, of course, only works if you have read access to those Kubernetes endpoints/resources from your local machine. If the endpoints are only visible from inside an enclosed environment, this will not work.)

This paper will showcase a prototype of an extension made for visual studio that validates object references in Kubernetes Object Definitions continuously while the developer is typing. The tool aims to incorporate both plain local YAML-files, and output generated by tools like Helm or Kustomize, and scan what resources already exist in a running Kubernetes Cluster. The aim is to provide the developer with valuable information that reduces the number of bugs encountered when deploying and speeds up the debugging process. I will refer to the extension as _Kubernetes Reference Highlighter_ (KRH).
Ten developers are given a task to debug a system. Half of them will do it with the extension enabled, and the others won't. The time it takes for each developer will be tracked and evaluated. 

<!-- ## 3.1. Problem formulation
	
- Analyze the existing challenges and issues that can occur when creating resources in Kubernetes
- Describe and analyze existing tools for validating Kubernetes manifests
- Design/implement/evaluate a tool for validating Kubernetes manifests to reduce the number of errors/issues -->

---


# 6. Related tools | Existing tools

In this section, existing tools are listed that aim to help the developer create correct/valid Kubernetes Object Definitions and tackle some of the challenges explained in the introduction-section.

- **JetBrains IntelliJ IDEA Kubernetes Plugin** [[link](https://plugins.jetbrains.com/plugin/10485-kubernetes)]: The full version IntelliJ that includes support for plugins is a paid product and therefore is not accessible publicly. JetBrains' plugin only takes local files into account when highlighting references. The plugin does not check your current cluster or build anything with kustomize like KRH. But JetBrains' plugin comes with extra functionality that lets the user jump between files by clicking the highlighted references (something that KRH does not).
- **KubeLinter** [[docs](https://docs.kubelinter.io/#/)] [[GitHub](https://github.com/stackrox/kube-linter)]: This is a open source Command Line Tool that validates your Kubernetes manifests. KubeLinter is a feature-rich tool that informs and warns of all sorts of issues that may be their code. The full list of features can be found [[Here](https://docs.kubelinter.io/#/generated/checks)]. KubeLinter is ideal to integrate into testing-pipelines where it can function as an initial step for everything YAML before it goes into production. KubeLinter can validate Helm Charts but can not validate Kustomize templates. The tool only checks the local files it is provided, so it does not know what already exists in a cluster. <!-- "KubeLinter is also highly configurable. Users can easily create their own custom rules and enable and disable rules depending on the policies required for specific namespaces. Adding custom rules in Kubelinter requires minimal work. It can be integrated easily into your CI/CD tool, such as GitHub Action, Jenkins, or Travis CI, for automated checking and error identification of application configurations."[[soruce](https://kubevious.io/blog/post/top-kubernetes-yaml-validation-tools#kubelinter)] -->
- **kube-score** [[GitHub](https://github.com/zegl/kube-score)] [[Validation Checks](https://github.com/zegl/kube-score/blob/master/README_CHECKS.md)]: kube-score is a tool that performs static code analysis of your Kubernetes object definitions. Even though there are over 30 different checks, the value is quite limited. The tool seems to only validate all the Kubernetes object definitions individually and not as a whole (with e.g., reference checking). Furthermore, just like *KubeLinter*, it is a Command Line tool and, therefore, can be integrated as part of a testing-pipeline and does not provide any live feedback when coding in an IDE.
- **Kubevious** [[docs](https://kubevious.io/docs/built-in-validators/)] [[GitHub](https://github.com/kubevious/kubevious)] . This tool comes with 44 built-in Kubernetes Resource validations checks. The checks include cross-file checks that, e.g., validate if a `service` points to two deployments at the same time and that sort of misconfiguration. Kubevious has a powerful toolset just like KubeLinter, but this tool has a UI and needs to be run in a cluster or as a stand-alone program. It can only run its checks on resources already deployed to Kubernetes and therefore does not do any live validation for the developer while coding. This tool is mainly for finding and debugging issues after it has already been deployed.
- **Conftest** [[GitHub](https://github.com/open-policy-agent/conftest)], **Copper** [[GitHub](https://github.com/cloud66-oss/copper)], and **Config-lint** [[GitHub](https://github.com/stelligent/config-lint)] are all similar tools that try to validate Kubernetes Manifests/YAML, but none of them come with built-in checks, so the user have to make their own "rules" that the YAML will be validated against. All these tools are Command Line tools, so they do not provide any live feedback but only validation when the command run. These tools accelerate when you want to build your own custom checks (maybe on your own Custom Resource Definition (CRDs)).

What is shared across all the tools listed above is that none of them manage to do reference checking across multiple files in a continuous manner that both takes local files, templating tools, and actual running clusters into account and is free to use at the same time.

# 7. Prototype | Implementation

This section will describe a prototype of the _Kubernetes Reference Highlighter_ VS Code Extension.

## 7.1. Overview

<!-- intro -->
The tool is built as a Visual Studio Code (VS Code) extension since it is free and is the most popular IDE/Editor in the industry [[source](https://survey.stackoverflow.co/2022/#most-popular-technologies-new-collab-tools)]. The extension is made in Typescript since that is the default for developing VS Code Extensions since _VS Code_ is written in Typescript. 

<!-- What it does -->
The extension highlights the name of an object if it finds a reference in the open file. The highlighting updates in real-time while you type and gives you constant feedback on if your references are found or not.

<p float="left">
  <img src="/images/pod-workspace-secret.png" width="600" />
</p>

> Fig. 1 shows how the extension would highlight the string `svc` in the VS Code because it found an object with that name file `./service.yml`. On this image the VS Code extension, _Error Lens_, is enabled to better visualize the highlighting. 

A tool like this is close to useless if the developer can not rely on the validity of the feedback it gives. This is why this tool aims to only highlight a string if it is sure that the reference exists. It is better to have false negatives than false positives in this case.

<!-- vscode.diagnostics -->
This extension makes use of `vscode.diagnostics` for highlighting strings. Diagnostics are the squiggly line under code lines, and the severity can either be marked as an `Severity.Error`, `Severity.Warning`, `Severity.Information`, or `Severity.Hint`. This extension uses the `Severity.Information` for all object-references, and it only uses `Severity.Error`, when `Kustomize build <path>` fails. Since these Diagnostics are built into the VS Code IDE, then other extensions or tools can also read and act upon the information provided by this extension. This makes this extension integrate well with other VS Code features/extensions. In particular, I suggest installing _Error Lens_ together with this extension to visualize the diagnostics even better for the user. 

<!-- _Reference Collection_ and _Reference Detection_ -->
The extension's architectural structure can be split up into two components/steps: _Reference Collection_ and _Reference Detection_. _Reference Collection_ is the step that collects and builds a list of all the objects the extension can find. This step is triggered every time you save a YAML-file in the workspace. _Reference Detection_ is the step that parses the currently open file and tries to find references that match objects found in the _Reference Collection_-step. This step is triggered every time a YAML-file is changed in the workspace.

## 7.2. Reference Detection 
As of Version 0.0.2, the extension highlights references to  `Services`, `Deployments`, `Secrets`, and `ConfigMaps`. More kinds can easily be added in the future.

The extension use YAML-parsing and Regex as the main method for reading the files in the workspace. 

All resources are namespace-sensitive. An object-reference will not be highlighted if the resource exclusively exists in another namespace.

Raw hostname addresses pointing to `Service`s are a bit different and the most difficult ones to handle. You can either call a `Service` by using its name as an address if you call it from inside its namespace (`my-service`) or call it from anywhere within the cluster by suffixing the `Service`-name with its namespace (`my-service.its-namespace`). This tool will only highlight an address pointing to a service if it exists inside the same namespace or the address is suffixed with its namespace. This is an important distinction that can prevent many issues related to traffic routing, where you try to access a service that may be in a different namespace.
Raw addresses are, in general, difficult to detect because they can be written as part of a string in many places. E.g., the address of `service` can be written as part of an environment variable accessible from a Pod, or it can be stored as a field in a ConfigMap, which is read from a Pod. The chance of detecting these references is more challenging, and there is a bigger risk of detecting false positives. 

If the string matches with multiple objects, the extension will show all the references. A reference can, as an example, exist both in the running cluster and in the local file because the object is already deployed to the cluster.
<p float="left">
  <img src="/images/multi-found-big.png" width="700" />
</p>
<!-- It is now up to the developer to mentally filter which of these piece of information are useful in what he is trying to do.  -->

<!-- KubeLinter and dangling references -->
<!-- Why is this here? -->
KubeLinter detects "dangling references", so it informs the user that a reference does not exist. This is great, but often times you do not have the whole infrastructure configuration locally, meaning that the dangling references that it detects may not be dangling after all because the references actually exist in the cluster. This ensures the KubeLinter can report false positives (detecting an issue that is not an issue).

## 7.3. Reference Collection

The tool is able to read plain YAML-files in the workspace, read generated output by Kustomize, and fetch objects from a running cluster. The tools do not parse the output of _Helm Carts_. Further research and development are needed to conclude if that is such a feature is feasible.

- **Cluster Scanning**: KRH uses the user's current context found in the kube_config to call the Kubernetes Cluster and collects the names of the Kubernetes objects that way.
- **Workspace Scanning**: KRH traverses all files ending with `.yml`. or `.yaml` in the currently open workspace in VS Code. It collects the `kind`, `name`, and `namespace` of all the Kubernetes objects found in the files.
- **Kustomize Scanning**: KRH traverses all files named `kustomization.yml` or `kustomization.yml` in the currently open workspace in VS Code and builds the kustomize files. All the Kubernetes objects generated by `kustomize` is collected. In addition to that the extension will also highlight if the Kustomization-file builds or not.
  <p float="left">
    <img src="/images/kustomize-success.png" width="400" />
    <img src="/images/kustomize-fail.png" width="387" /> 
  </p>
  
  If _Kustomize_ is not installed on the computer and part of the default shells PATH, it will notify the user.

Each time you save a YAML-file in VS Code, the extension will update its internal list of Kubernetes objects.
Each of these scanning techniques can be disabled through the CommandLine or through settings. 

<!-- Kustomize is extra difficult -->
Kustomize is extra challenging to handle because it is built on the idea of ["bases"](https://kubectl.docs.kubernetes.io/references/kustomize/glossary/#base) and ["overlays"](https://kubectl.docs.kubernetes.io/references/kustomize/glossary/#overlay). Overlays use a base-configuration and add/delete/modify/override the existing configuration. Multiple overlays can use the same base, and a base has no knowledge of the overlays that refer to it. Overlays can be chained to infinity, which means that when the extension builds a kustomization, it doesn't know if this is the final configuration or if one or more overlays override it in a different folder. Traversing the dependency tree of overlays depending on each other is beyond the scope of this Paper. The tool will instead just inform the user of references it finds in all the kustomization layers, and then it is up to the developer to check which layer he/she meant to refer to.
The fact that the extension highlights which kustomize-files builds or doesn't build can be very useful in debugging a long chain of kustomize layers. 

<img src="/image-ignore/icon_kustomize-tree-2.png" width="330" />

---

# 8. Evaluation


- Years of professional experience
- Years of professional experience with Kubernetes
- Would you recommend this extension to others?
- Over the last month, did it help your daily work?
- How many bugs/issues did it help you catch
- Percentage estimate of how often it proves false positives (the extension highlighting wrong references)
- Percentage estimate of how often it provides false negatives (not highlighting a reference that is actually there)
- What type of scanning do you find most useful? (Cluster, plaintext, Kustomize)

## 8.1. Results

## 8.2. Limitations

# 9. Conclusion

This paper has 

open source
Handles templating
Live feedback
danling references

# 10. References