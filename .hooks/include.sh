#!/bin/bash

function yarn_helper() {
	if [ "${CI:-}" == "true" ]; then
		return
	fi
	pnpm install --prefer-offline --frozen-lockfile
}
