.PHONY: test

test:
	python3 scripts/validate-package.py
	bash -n scripts/install-local.sh
