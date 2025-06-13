import { GetLogger } from 'pandora-common';
import { useEffect, useRef, useState } from 'react';

export function useFetchedResourceText(url: URL | string): string | null {
	const requestedUrl = useRef(url);
	requestedUrl.current = url;
	const [result, setResult] = useState<null | [url: URL | string, result: string]>(null);

	useEffect(() => {
		let cancel = false;

		fetch(url)
			.then((r) => r.text())
			.then((r) => {
				if (!cancel && requestedUrl.current === url) {
					setResult([url, r]);
				}
			})
			.catch((err) => {
				GetLogger('useFetchedResourceText').warning('Error fetching resource', url, ':', err);
			});

		return () => {
			cancel = true;
		};
	}, [url]);

	return (result != null && result[0] === url) ? result[1] : null;
}
