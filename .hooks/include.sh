#!/bin/bash

function yarn_helper() {
	if [ "${CI:-}" == "true" ]; then
		return
	fi
	yarn install --prefer-offline --frozen-lockfile
}
