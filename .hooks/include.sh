#!/bin/bash

function pnpm_helper() {
	if [ "${CI:-}" == "true" ]; then
		return
	fi

	# Update npm keys (ignoring any failures)
	local npm_keys="$(curl -s https://registry.npmjs.org/-/npm/v1/keys | jq -c '{npm: .keys}' || echo '')"
	if [[ "$npm_keys" ]]; then
		export COREPACK_INTEGRITY_KEYS="$npm_keys"
	fi

	# Do not prompt for user confirmation if downloading new pnpm version
	export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

	# Do a pnpm install
	# We set "CI=true" to bypass any potential prompts (e.g. when purging node_modules would be needed)
	CI=true pnpm install --prefer-offline --frozen-lockfile --color
}
