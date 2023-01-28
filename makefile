update:
	npm install
	vsce package && code --install-extension kubernetes-reference-highlighter-$$(cat package.json | jq '.version' -r).vsix