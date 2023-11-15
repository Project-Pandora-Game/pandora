import { GetLogger } from 'pandora-common';
import { useMemo, useRef } from 'react';

const logger = GetLogger('Debug-WhatChanged');

export function useWhatChangedMemo(data: readonly unknown[], name?: string): void {
	const prevDataRef = useRef(data);

	useMemo(() => {
		if (prevDataRef.current === data)
			return;

		if (prevDataRef.current.length !== data.length) {
			logger.error(`useWhatChangedMemo data length changed: ${data.length} vs ${prevDataRef.current.length}`, data, prevDataRef.current);
			prevDataRef.current = data;
			return;
		}

		const changes: [number, unknown, unknown][] = [];

		for (let i = 0; i < data.length; i++) {
			const oldElement = prevDataRef.current[i];
			const element = data[i];
			if (element !== oldElement) {
				changes.push([i, element, oldElement]);
			}
		}

		if (changes.length > 0) {
			logger.debug(
				`Data changed${name ? ` (${name})` : ''}:\n`,
				...changes.flatMap(([index, newData, oldData]) => [
					`===== Index ${index} =====`,
					`\nOld:\n`,
					oldData,
					`\nNew:\n`,
					newData,
				]),
			);
		}

		prevDataRef.current = data;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, data);
}
