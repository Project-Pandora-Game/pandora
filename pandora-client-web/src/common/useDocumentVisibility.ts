import { useEffect, useState } from 'react';

export function useDocumentVisibility(): boolean {
	const [visible, setVisible] = useState(document.visibilityState === 'visible');
	useEffect(() => {
		const onVisibilityChange = () => setVisible(document.visibilityState === 'visible');
		document.addEventListener('visibilitychange', onVisibilityChange);
		onVisibilityChange();
		return () => document.removeEventListener('visibilitychange', onVisibilityChange);
	}, []);
	return visible;
}
