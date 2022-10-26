#!/bin/bash

set -euo pipefail

open_semaphor() {
	mkfifo pipe-$$
	exec 3<>pipe-$$
	rm pipe-$$
	local count=${1:-$(nproc)}
	for ((i=0; i<count; i++)); do
		printf %s 000 >&3
	done
}

CHILD_PIDS=()

run_with_lock() {
	local code
	read -u 3 -n 3 code && ((0==code)) || exit $code
	(
		( "$@"; )
		printf '%.3d' $? >&3
	) &
	CHILD_PIDS+=($!)
}

run_single() {
	local name=$1
	local action=$2
	case $name in
		common)
			name='pandora-common'
			;;
		server-*)
			name="pandora-server-$name"
			;;
		directory)
			name='pandora-server-directory'
			;;
		shard)
			name='pandora-server-shard'
			;;
		client|client-web|web)
			name='pandora-client-web'
			;;
		*)
			;;
	esac

	yarn workspace "$name" "$action"
}

ACTION=$1
shift

open_semaphor

while [ $# -gt 0 ]; do
	run_with_lock run_single "$1" "$ACTION"
	shift
done

EXIT_CODE=0
for pid in "${CHILD_PIDS[@]}"; do
	wait "$pid" || CODE=$?
	if [ "${CODE:-0}" -ne 0 ]; then
		EXIT_CODE=1
	fi
done

exit $EXIT_CODE
