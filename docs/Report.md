# 1. Kubernetes Resource Validation


# 2. Abstract

# 3. Table of Contents
- [1. Kubernetes Resource Validation](#1-kubernetes-resource-validation)
- [2. Abstract](#2-abstract)
- [3. Table of Contents](#3-table-of-contents)
- [Motivation](#motivation)
  - [3.1. Problem formulation](#31-problem-formulation)
- [Existing tools](#existing-tools)
- [Prototype](#prototype)
  - [Implementation](#implementation)
- [Evaluation](#evaluation)
  - [Results](#results)
  - [Limitations](#limitations)
- [Conclusion](#conclusion)

# Motivation

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




## 3.1. Problem formulation
	
- Analyze the existing challenges and issues that can occur when creating resources in Kubernetes
- Describe and analyze existing tools for validating Kubernetes manifests
- Design/implement/evaluate a tool for validating Kubernetes manifests to reduce the number of errors/issues

# Existing tools


# Prototype

## Implementation

# Evaluation

## Results

## Limitations

# Conclusion