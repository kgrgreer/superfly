.PHONY: run
run: src/loader test.x86
	@echo Running loader
	$<

test.x86: src/x86.js src/sf.js
	node $<
