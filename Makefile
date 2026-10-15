.PHONY: test test-web test-web-browser pack-web

test:
	python3 scripts/validate-package.py
	bash -n scripts/install-local.sh

pack-web:
	mkdir -p dist
	npm pack --offline --ignore-scripts ./web --pack-destination ./dist

test-web: pack-web
	node --test scripts/test-web-package.mjs

test-web-browser: pack-web
	node --test scripts/test-web-browser.mjs
