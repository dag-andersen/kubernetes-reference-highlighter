update:
	code --uninstall-extension dag-andersen.kubernetes-reference-highlighter || true
	npm install
	vsce package && code --install-extension kubernetes-reference-highlighter-$$(cat package.json | jq '.version' -r).vsix

publish:
	vsce publish

uninstall:
	code --uninstall-extension dag-andersen.kubernetes-reference-highlighter