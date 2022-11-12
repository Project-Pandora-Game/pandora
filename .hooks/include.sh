#!/bin/bash

function pnpm_helper() {
	if [ "${CI:-}" == "true" ]; then
		return
	fi
	pnpm install --prefer-offline --frozen-lockfile
}
