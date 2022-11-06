<center> Kubernetes Resource Validation </center>

<!-- 
//TODO
  - reddit post
  - slack post 


Forklarer kubernetes rigtig godt: https://web.archive.org/web/20220608212956id_/https://dl.acm.org/doi/pdf/10.1145/3539606

-->



# 1. Abstract

Linters and static code analysis in some domains has proven to help developers catching bugs and speeding up their development. Kubernetes is growing in popularity, but the tooling for validating configuration files is limited. By design Kubernetes will accept Kubernetes-manifests with broken references because there is no order to the creation of objects, so a missing resources may exist in a short while. Furthermore, you typically only have a subset of the full infrastructure configuration on your local machine, so many of the code references and objects will naturally be broken, and the tools will often give incorrect/inadequate valuation. The tools that exist only looks at plain local YAML-files. This paper presents a prototype of an Visual Studio Code Extension published to the VS Code Marketplace. The tool highlight references in YAML-files based on plain local files, objects that exists in running clusters, and objects generated generated output by _Kustomize_. The extension is tested on X people for a month. A small survey is conducted based on their response and feedback. The main response was that reference-highlighting is useful and can prevent errors in curtain situations. The tools is not perfect and does not find all references it is still useful. It proves that even simple highlighting can limit bugs and thus increase productivity. Further research and development is needed to ...

---

- The source code can be found on [Github](https://github.com/dag-andersen/kubernetes-reference-highlighter) and it can installed from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dag-andersen.kubernetes-reference-highlighter).

---

# 3. Keywords
- Open Source Software, IDE Extension, Code Linting, Static code analysis, Code Validation, Kubernetes

# 4. Introduction

<!-- Intro -->

**Background**
Container Orchestration and Kubernetes are continuously getting more popular during the last couple of years. Around 25-30% of professional developers use Kubernetes (25.45% [[StackOverflow Survey 2022](https://survey.stackoverflow.co/2022/#section-most-popular-technologies-other-tools)], 30% [[SlashData’s Developer Economics survey](https://developer-economics.cdn.prismic.io/developer-economics/527f60d6-d199-4db8-bd31-6dde43719033_The+State+of+Cloud+Native+Development+March+2022.pdf)], and around one-fourth of the remaining wants to work with Kubernetes in the future [[StackOverflow Survey 2022](https://survey.stackoverflow.co/2022/#most-loved-dreaded-and-wanted-tools-tech-want)]. So we can expect that more and more developers will be deploying and configuring infrastructure on Kubernetes through YAML.

However, Kubernetes is known for being remarkably complex, and hence the learning curve can be quite steep. In a survey done by StackOverflow it is shown that 74,75% of the developers who use Kubernetes "loves it" and the remaining 25,25% "dreads it" [[source](https://survey.stackoverflow.co/2022/#section-most-popular-technologies-other-tools)]. Why the ~25% of the participants _dread_ Kubernetes is not specified in the survey, but anything that would lower that percentage is worth striving for. 

<!-- 96% of organizations in 2021 are either using or evaluating Kubernetes [[source](https://www.cncf.io/wp-content/uploads/2022/02/CNCF-AR_FINAL-edits-15.2.21.pdf)].  -->
<!-- A survey conducted by New Relic reports that 88% of IT decision-makers are exploring Kubernetes and Containers [[source](https://newrelic.com/sites/default/files/2021-09/New_Relic_Report%20_2021_Observability_Forecast_Sept.pdf)]. -->
<!-- 9/10 of those who use Kubernetes are professionals. [[source](https://developer-economics.cdn.prismic.io/developer-economics/527f60d6-d199-4db8-bd31-6dde43719033_The+State+of+Cloud+Native+Development+March+2022.pdf)] -->

The ecosystems around Kubernetes are constantly evolving, and it can be difficult to keep up with the newest tools and features. When building workloads aimed at running on Kubernetes, most configuration is done in YAML and revolves around Kubernetes Object Definitions. This means we, as a community, need to ensure that we have the proper tooling for validating this infrastructure. Both to speed up the development process but also to reduce the number of errors that goes into production. The sooner the bug is found in the software process, the cheaper it is to correct [[source](https://deepsource.io/blog/exponential-cost-of-fixing-bugs/)].

**Problem**
It is very easy to make mistakes when deploying to Kubernetes. There are strict rules of what fields you can add in your Kubernetes Object Definition, but there are no checks that the values provided are valid (besides the fact that it needs to be the correct type) - e.g., your _Pod_ can request environment variables from a secret that does not exist, or your `service` can point to Pods that do not exist. 

<!-- Terraform an kubernetes -->
Terraform does static validation checks, so you will be informed about your broken references before you apply your code. By design, Kubernetes does not do that and can not do that. Kubernetes objects are not expected to be created at the same time or in a given order, so we can not talk about a "compile" time. Kubernetes is managed with Control Planes, and there is no order to when which resource is created/scheduled. In Kubernetes, your references will often not exist on creation time but will only be created at a later point. This explains why there is no static validation by default when creating Kubernetes resources. 

<!-- Yaml -->
Kubernetes object definitions are written in YAML. YAML is a data serialization language that only knows the concepts of primitive data types like arrays, strings, numbers, etc., and therefore does not know the concept of references. All references declared in your Kubernetes objects definition is written as a string, with no type checking or validation. This means there is no built-in reference validation in YAML.

<!-- Linters -->
Since most IDEs, plugins, or tools do not verify any of the magic strings in you YAML-files, it can be quite cumbersome to debug the code. It typically involves a human manually reading through all magic string until you discover that there is a typo or each of your resources exists in two different namespaces and, therefore, can't communicate. No public and free IDE feature or extension exist that checks this.

<!-- extended problem: kustomize -->
Furthermore, developers often use tools like _Helm_ and _Kustomize_ to template their YAML-files. This is done so multiple configurations can inherit/share common code across different configurations. This means that references that are hardcoded in the files may not exist in any of the plain files but may only be generated on `runtime` when one of the templating tools is used. This makes it much harder to give valuable information to the developer because Kubernetes objects' names are dynamically generated by the tool. I have not found any extension that tries to tackle this challenge, so currently, developers don't get any assistance validating their YAML-files live while coding when using templating tools like _Helm_ and _Kustomize_. 

<!-- 6% of people think Kustomize and 26% think helm is the way to go [[source](https://juju.is/cloud-native-kubernetes-usage-report-2022#what-is-the-best-way-to-manage-software-on-kubernetes)]. 20% use kustomize and 65% use helm [[source](https://grem1.in/post/k8s-survey-2022-1/)]. -->

<!-- solution -->
Currently, plenty of open-source validation tools exist for Kubernetes Object Definition, but most of them are Command Line tools and do not give continuous feedback live while the developer is coding. Furthermore, the tools only validate the definitions based on the local files provided to the tool and not what is actually running in a Kubernetes Cluster. Typically, you only have a subset of the full infrastructure configuration on your local machine, so many of the code references and objects will naturally be broken, and the tools will give incorrect/inadequate valuation. So in order to overcome this, we need to look outside the borders of the IDE/current folder. (This, of course, only works if you have read access to those Kubernetes endpoints/resources from your local machine. If the endpoints are only visible from inside an enclosed environment, this will not work).

This paper will showcase a prototype of an extension made for visual studio that validates object references in Kubernetes Object Definitions continuously while the developer is typing. The tool aims to incorporate both plain local YAML-files, and output generated by tools like Helm or Kustomize, and scan what resources already exist in a running Kubernetes Cluster. The aim is to provide the developer with valuable information that reduces the number of bugs encountered when deploying and speeds up the debugging process. I will refer to the extension as _Kubernetes Reference Highlighter_ (KRH).

Ten developers are given a task to debug a system. Half of them will do it with the extension enabled, the other half without the extension. The time it takes for each developer to debug the system will be tracked and evaluated. 

The goal with this paper/tool is not to write a perfect and fully optimized Code Linter, but instead demonstrate that reference highlighting can limit the amount of bugs/issues when working with Kubernetes. 

<!-- ## 3.1. Problem formulation
	
- Analyze the existing challenges and issues that can occur when creating resources in Kubernetes
- Describe and analyze existing tools for validating Kubernetes manifests
- Design/implement/evaluate a tool for validating Kubernetes manifests to reduce the number of errors/issues -->

---

# Related Work

**Why developers use Linters**

In dynamic languages like JavaScript, where there are no _compile time_-checks, it has been shown that developers use static analysis tools (_Linters_) like _ESLint_ to prevent errors. Linters like _ESLint_ can be integrated with popular IDEs like VS Code or IntelliJ IDEA [1].
Preventing Errors is said to be the number one reason to use a linter because it catches the bugs early on, so you don't have to spend time debugging it on runtime [1]. The linter gives the developer continuous feedback on whether their code has errors or not. So even though a language like Javascript does not have static compile time checks, it is still possible to reduce a substantial amount of errors by using Linters running in your IDE. 

Similar results has been shown in studies related to Android programming. Android Develops report that they use linters to save time by detecting bugs and identifying unused resources. [2] Furthermore "Developers always want to maintain a good reputation among their peers, and the linter can help them to do that", by ensuring that their work meets the expectations of their superiors and colleagues. <!-- “Lint helps you to save time in a lot of ways. One that comes to my mind is the identification of unused resources. The linter saves me a lot of time as I don’t have to cross-check all resources manually" --> <!-- "Linters are also known for saving time in contexts where eventual issues can be automatically detected, e.g., bug detection" -->

**Why developers do not use Linters**
Studies have shown that some of the main reasons why a linting tools are underused is that they produce too many _false positives_ and the amount of warnings are too high, which overloads the developer [3].

Users will stop using the tool if they loose trust in it, because of too many false positives. [4] Also not all "false positives are not all equal". To get people to trust and use the tool, it is important that the user don't experience false positives on simple issues. It is less important if it is a false positive on a complicated issue.

Furthermore the user will interpret correct feedback as false positive if they don't understand the feedback. "A misunderstood explanation means the error is ignored or, worse, transmuted into a false positive."[4]. "If people don’t understand an error, they label it false" [4]. So it is very important that the tool provide easy to understand feedback if the user should trust the linting tool. 

Other reasons developers don't use linters are that they can be difficult to configure. [3]

Same study shows that users what feedback from the tool as fast a possible and it should preferably be integrated with the IDE. [3]

---

# 6. Existing tools

In this section, existing tools are listed that aim to help the developer create correct/valid Kubernetes Object Definitions and tackle some of the challenges explained in the introduction-section.
The tools are collected by reading blogposts online and reading "alternative tools" on Github.  

- **JetBrains IntelliJ IDEA Kubernetes Plugin** [[link](https://plugins.jetbrains.com/plugin/10485-kubernetes)]: The full version IntelliJ that includes support for plugins is a paid product and is therefore not publicly accessible. JetBrains' plugin only takes local files into account when highlighting references. The plugin does not check your current cluster or build anything with kustomize like KRH. But JetBrains' plugin comes with extra functionality that lets the user jump between files by clicking the highlighted references (something that KRH does not).
- **KubeLinter** [[docs](https://docs.kubelinter.io/#/)] [[GitHub](https://github.com/stackrox/kube-linter)]: This is a open source Command Line Tool that validates your Kubernetes manifests. KubeLinter is a feature-rich tool that informs and warns of all sorts of issues that may be their code. The full list of features can be found [[Here](https://docs.kubelinter.io/#/generated/checks)]. KubeLinter is ideal to integrate into testing-pipelines where it can function as an initial step for everything YAML before it goes into production. KubeLinter can validate Helm Charts but can not validate Kustomize templates. The tool only checks the local files it is provided, so it does not know what already exists in a cluster. <!-- "KubeLinter is also highly configurable. Users can easily create their own custom rules and enable and disable rules depending on the policies required for specific namespaces. Adding custom rules in Kubelinter requires minimal work. It can be integrated easily into your CI/CD tool, such as GitHub Action, Jenkins, or Travis CI, for automated checking and error identification of application configurations."[[soruce](https://kubevious.io/blog/post/top-kubernetes-yaml-validation-tools#kubelinter)] -->
KubeLinter detects "dangling references", so it informs the user if a reference does not exist. That is good, but often you do not have the whole infrastructure configuration locally, meaning that the dangling references that it detects may not be dangling after all because the references actually exist in the cluster. This means that the KubeLinter can report false positives (detecting an issue that is not an issue), which can result in the developer not trusting the tool and thus disabling the tool as described in the _Related Work_-section
- **kube-score** [[GitHub](https://github.com/zegl/kube-score)] [[Validation Checks](https://github.com/zegl/kube-score/blob/master/README_CHECKS.md)]: kube-score is a tool that performs static code analysis of your Kubernetes object definitions. Even though there are over 30 different checks, the value is quite limited. The tool seems to only validate all the Kubernetes object definitions individually and not as a whole (with e.g., reference checking). Furthermore, just like *KubeLinter*, it is a Command Line tool and, therefore, can be integrated as part of a testing-pipeline and does not provide any live feedback when coding in an IDE.
- **Kubevious** [[docs](https://kubevious.io/docs/built-in-validators/)] [[GitHub](https://github.com/kubevious/kubevious)]: This tool comes with 44 built-in Kubernetes Resource validation checks. The checks include cross-file checks that, e.g., validate if a `service` points to two deployments at the same time and that kind of misconfiguration. Kubevious has a powerful toolset just like KubeLinter, but this tool has a UI and needs to be run in a cluster or as a stand-alone program. It can only run its checks on resources already deployed to Kubernetes and therefore does not do any live validation for the developer while coding. This tool is mainly for finding and debugging issues after it has already been deployed.
- **Conftest** [[GitHub](https://github.com/open-policy-agent/conftest)], **Copper** [[GitHub](https://github.com/cloud66-oss/copper)], and **Config-lint** [[GitHub](https://github.com/stelligent/config-lint)] are all similar tools that try to validate Kubernetes Manifests/YAML, but none of them come with built-in checks, so the users have to make their own "rules" that the YAML will be validated against. All these tools are Command Line tools, so they do not provide any live feedback but only validation when the command is run. These tools accelerate when you want to build your own custom checks (maybe on your own Custom Resource Definition (CRDs)).

What is shared across all the tools listed above is that none of them manage to do reference checking across multiple files in a continuous manner that both takes local files, templating tools, and actual running clusters into account and at the same time is free to use.

---

# 7. Prototype | Implementation

This section will describe a prototype of the _Kubernetes Reference Highlighter_ VS Code Extension.

## 7.1. Overview

<!-- intro -->
The tool is built as a Visual Studio Code (VS Code) extension since it is free and is the most popular IDE/Editor in the industry [[source](https://survey.stackoverflow.co/2022/#most-popular-technologies-new-collab-tools)]. The extension is made in Typescript since that is the default for developing VS Code Extensions since _VS Code_ is written in Typescript. 

<!-- What it does -->
The extension highlights the name of an object if it finds a reference in the open file. The highlighting updates in real-time while you type and gives you constant feedback on whether your references are found or not.

<p float="left">
  <img src="/images/pod-workspace-secret.png" width="600" />
</p>

> Fig. 1 shows how the extension would highlight the string `svc` in the VS Code because it found an object with that filename`./service.yml`. On this image, the VS Code extension, _Error Lens_, is enabled to better visualize the highlighting. 

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
<!-- It is now up to the developer to mentally filter which of these pieces of information are useful in what he is trying to do.  -->

<!-- KubeLinter and dangling references -->
<!-- Why is this here? -->

## 7.3. Reference Collection

The tool is able to read plain YAML-files in the workspace, read generated output by Kustomize, and fetch objects from a running cluster. The tools do not parse the output of _Helm Carts_. Further research and development are needed to conclude if such a feature is feasible.

- **Cluster Scanning**: KRH uses the user's current context found in the kube_config to call the Kubernetes Cluster and collects the names of the Kubernetes objects that way.
- **Workspace Scanning**: KRH traverses all files ending with `.yml`. or `.yaml` in the currently open workspace in VS Code. It collects the `kind`, `name`, and `namespace` of all the Kubernetes objects found in the files.
- **Kustomize Scanning**: KRH traverses all files named `kustomization.yml` or `kustomization.yml` in the currently open workspace in VS Code and builds the kustomize files. All the Kubernetes objects generated by `kustomize` is collected. In addition, the extension will also highlight if the Kustomization-file builds or not.
  <p float="left">
    <img src="/images/kustomize-success.png" width="400" />
    <img src="/images/kustomize-fail.png" width="387" /> 
  </p>
  
  If _Kustomize_ is not installed on the computer and part of the default shells PATH, it will notify the user.

Each time you save a YAML-file in VS Code, the extension will update its internal list of Kubernetes objects.
Each of these scanning techniques can be disabled through the CommandLine <!-- wrong name --> or through settings. 

<!-- Kustomize is extra difficult -->
Kustomize is extra challenging to handle because it is built on the idea of ["bases"](https://kubectl.docs.kubernetes.io/references/kustomize/glossary/#base) and ["overlays"](https://kubectl.docs.kubernetes.io/references/kustomize/glossary/#overlay). Overlays use a base-configuration and add/delete/modify/override the existing configuration. Multiple overlays can use the same base, and a base has no knowledge of the overlays that refer to it. Overlays can be chained to infinity, which means that when the extension builds a kustomization, it doesn't know if this is the final configuration or if one or more overlays override it in a different folder. Traversing the dependency tree of overlays depending on each other is beyond the scope of this Paper. Instead, the tool will inform the user of references it finds in all the kustomization layers, and then it is up to the developer to check which layer he/she meant to refer to.
The fact that the extension highlights which kustomize-files build or do not build can be very useful in debugging a long chain of kustomize layers. 

<img src="/image-ignore/icon_kustomize-tree-2.png" width="330" />

> Figure X: Visualization of how the extension shows where overlays fail in a chain of overlays. The bases are at the bottom levels, while each layer above the bases are overlays. 

---

# 8. Evaluation


The proper way of implementing a linter is to use some kind of abstraction syntax tree and pass tokens, but with the limited amount of time for this project Regex-matching acceptable is proof of concept. Using Regex has the risk of producing false positives or false negatives. If there is an edge-case my regex does not catch then a reference will not be found and produce a false negative (not highlighting something that should be highlighted).

To evaluate if this VS Code extension reference highlighting can limit the amount of bugs/issues when working with Kubernetes, I have asked developers through slack-channels, Reddit, and other social medias/groups to try using the tool in their daily work for an month. Since the tool is publicly available in the VS Code Marketplace it is possible that people have also found it by chance. The participants was asked to fill in a survey. The survey was conducted in Google Forms and was available from the extension's marketplace-page.

When the extension have been installed for 15 days a message will ask the user if they would like to fill out a survey. If they click "open" the survey will open in their browser. If they click "later" they will be asked again in 5 days. After the user have opened the survey or click "later" 3 times the message will not longer popup. 

**The questions and answers from the survey is listed here:**
| Question \ participant                                                                                          | person1 | person2 | person3 | person4 | person5 | person6 |
| --------------------------------------------------------------------------------------------------------------- | ------- | ------- | ------- | ------- | ------- | ------- |
| Years of professional experience                                                                                | 0       | 0       | 0       | 0       | 0       | 0       |
| Years of professional experience with Kubernetes                                                                | 0       | 0       | 0       | 0       | 0       | 0       |
| role/job position                                                                                               | 0       | 0       | 0       | 0       | 0       | 0       |
| How likely are you to recommend this to others working with Kubernetes? (1-5)                                   | 0       | 0       | 0       | 0       | 0       | 0       |
| Over the last month, did the extension help your daily work?                                                               | 0       | 0       | 0       | 0       | 0       | 0       |
| How many bugs did it help you catch                                                                             | 0       | 0       | 0       | 0       | 0       | 0       |
| How often does the extension give false positives (highlighting a wrong reference)        | 0       | 0       | 0       | 0       | 0       | 0       |
| Percentage estimate of how often it gives false negatives (not highlighting a reference that is actually there) | 0       | 0       | 0       | 0       | 0       | 0       |
| What type of scanning do you find most useful? (Cluster, plaintext/workspace, Kustomize)                        | 0       | 0       | 0       | 0       | 0       | 0       |

# 9. Conclusion

Based on the fact X out of X persons reported they experienced the bug help them catch a least 1 bug and no participant straight up said it had a negative impact on their productivity i would consider this extension an success. This paper shows that even with simple extension based on Regex it is possible to give developers valuable live validation of kubernetes object definition to catch bugs and increase productivity. 
Further research and development is needed to evaluate if an even better extension (with more complicated YAML parsing) would help developer catch even more bugs. 

<!-- example
We investigated in this paper the benefits and the constraints of using linters for performance purposes in Android apps. We con- ducted a qualitative study based on interviews with experienced Android developers. Our results provide motivations for developers to use linters for performance and share with them how to make this usage the most beneficial. Our findings highlight also the cur- rent challenges of using linters for performance. These challenges open up new research perspectives and show new needs for tool makers.
-->

<!-- example
We have presented LAGOON – an open source, reusable tool for analyzing OSS communities. The key highlights include various ingestion modules, data layering, entity fusion, a UI, and predictions on the health of OSS communities. The future of LAGOON comprises adding more ingestion modules and increasing the power of the platform to predict threats to OSS communities. The authors are happy to accept pull requests and extensions to LAGOON, and hope that the broader community can benefit from using it.
-->

<!-- example
This paper introduces TD Classifier, a TD identification tool that builds upon the collective knowledge acquired by three leadingTD tools and relies on open-source tools to automatically identify high-TD classes for any arbitrary Java project by pointing to its git repository. We demonstrate the tool’s usefulness by a case study using the Apache Commons IO project. Our evaluation shows thatTD Classifier is expected to facilitate TD management activities and enable further future experimentation through its use in an academic or industrial setting.TD Classifier will continue to evolve to meet the challenges posed by its use in both academia and practice. We plan to evaluate the tool and report additional qualitative analysis through a large-scale case study in an industrial setting. We also plan to improve the tool’s performance and scalability, as well as to extend it in other programming languages (e.g., C/C++, python, JavaScript, etc.), by incorporating additional analysis tools into the analysis pipeline.
-->

# 10. References

1. K. F. Tómasdóttir, M. Aniche and A. van Deursen, **"Why and how JavaScript developers use linters,"** 2017 32nd IEEE/ACM International Conference on Automated Software Engineering (ASE), 2017, pp. 578-589, doi: 10.1109/ASE.2017.8115668. https://pure.tudelft.nl/ws/files/26024522/ase2017.pdf
2. S. Habchi, X. Blanc and R. Rouvoy, **"On Adopting Linters to Deal with Performance Concerns in Android Apps,"** 2018 33rd IEEE/ACM International Conference on Automated Software Engineering (ASE), 2018, pp. 6-16, doi: 10.1145/3238147.3238197. https://lilloa.univ-lille.fr/bitstream/handle/20.500.12210/23088/https:/hal.inria.fr/hal-01829135/document?sequence=1
3. B. Johnson, Y. Song, E. Murphy-Hill, and R. Bowdidge, “Why don’t
software developers use static analysis tools to find bugs?” in 2013 35th
International Conference on Software Engineering (ICSE). IEEE, 2013,
pp. 672–681. https://homepages.dcc.ufmg.br/~figueiredo/disciplinas/2019b/ese/paper1joao.pdf
4. A. Bessey, K. Block, B. Chelf, A. Chou, B. Fulton, S. Hallem, C. HenriGros, A. Kamsky, S. McPeak, and D. Engler, “A few billion lines
of code later: using static analysis to find bugs in the real world,”
Communications of the ACM, vol. 53, no. 2, pp. 66–75, 2010. https://www.cs.jhu.edu/~huang/cs718/spring20/readings/bugs-realworld.pdf
