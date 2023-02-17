update:
	code --uninstall-extension dag-andersen.kubernetes-reference-highlighter || true
	npm install
	vsce package && code --install-extension kubernetes-reference-highlighter-$$(cat package.json | jq '.version' -r).vsix

publish:
	@gum confirm "Are you sure you want to publish version $$(cat package.json | jq '.version' -r)?"
	vsce publish

uninstall:
	code --uninstall-extension dag-andersen.kubernetes-reference-highlighter