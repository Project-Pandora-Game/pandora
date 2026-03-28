import { useEffect, useState } from 'react';

/**
 * @param precision - Update interval in milliseconds
 */
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

/**
 * @returns A Date object representing the current UTC minute, updated automatically at each minute boundary.
 */
export function useCurrentUtcTimeMinutes(): Date {
	const [time, setTime] = useState<Date>(() => {
		const now = new Date();
		now.setUTCSeconds(0, 0);
		return now;
	});

	useEffect(() => {
		const delay = time.getTime() + 60_000 - Date.now();
		if (delay > 0) {
			const id = setTimeout(() => {
				const now = new Date();
				now.setUTCSeconds(0, 0);
				setTime(now);
			}, delay);
			return () => clearTimeout(id);
		} else {
			const now = new Date();
			now.setUTCSeconds(0, 0);
			setTime(now);
			return undefined;
		}
	}, [time]);

	return time;
}
