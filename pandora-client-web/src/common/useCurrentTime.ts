import { useEffect, useState } from 'react';

export function useCurrentTime(precision: number = 1000): number {
	const [currentTime, setCurrentTime] = useState(Date.now());

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(Date.now());
		}, precision);
		return () => {
			clearInterval(interval);
		};
	}, [precision]);

	return currentTime;
}
