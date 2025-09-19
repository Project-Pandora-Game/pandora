import { AssertNever } from './misc.ts';

export function NaturalListJoin(list: readonly string[]): string {
	let res = list[0] ?? '';
	if (list.length > 1) {
		res = `${list.slice(1).join(', ')} and ${res}`;
	}
	return res;
}

/** Formats time in ms into days, hours minutes and seconds - also has a short mode that only shows the largest unit, e.g. 17h */
export function FormatTimeInterval(time: number, mode: 'full' | 'short' | 'two-most-significant' = 'full') {
	let res = '';
	if (time < 0) {
		res = '-';
		time *= -1;
	}
	const seconds = Math.floor(time / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (mode === 'short') {
		if (days > 1) {
			res += `${days}d`;
		} else if (hours > 1) {
			res += `${hours}h`;
		} else if (minutes > 1) {
			res += `${minutes}m`;
		} else {
			res += `${seconds}s`;
		}
		return res;
	}
	const parts: string[] = [];
	if (days > 0) {
		parts.push(`${days} day${days > 1 ? 's' : ''}`);
	}
	if (hours % 60 > 0) {
		parts.push(`${hours % 24} hour${hours > 1 ? 's' : ''}`);
	}
	if (minutes % 60 > 0) {
		parts.push(`${minutes % 60} minute${minutes > 1 ? 's' : ''}`);
	}
	if (seconds % 60 > 0 || parts.length === 0) {
		parts.push(`${seconds % 60} second${seconds > 1 ? 's' : ''}`);
	}
	switch (mode) {
		case 'full':
			return res + parts.join(', ');
		case 'two-most-significant':
			return res + parts.slice(0, 2).join(', ');
		default:
			AssertNever(mode);
	}
}

export type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Converts a time value in specified unit to milliseconds
 * @param time The time value
 * @param unit The unit of the time value
 * @returns The time value in milliseconds
 */
export function TimeSpanMs(time: number, unit: TimeUnit): number {
	switch (unit) {
		case 'milliseconds':
			return time;
		case 'seconds':
			return time * 1000;
		case 'minutes':
			return time * 1000 * 60;
		case 'hours':
			return time * 1000 * 60 * 60;
		case 'days':
			return time * 1000 * 60 * 60 * 24;
		case 'weeks':
			return time * 1000 * 60 * 60 * 24 * 7;
	}
	AssertNever(unit);
}

export function MessageSubstitute(originalMessage: string, substitutions: Readonly<Record<string, string>>): string {
	let message = originalMessage;
	for (const [key, value] of Object
		.entries(substitutions)
		// Do the longest substitutions first to avoid small one replacing part of large one
		.sort(([a], [b]) => b.length - a.length)
	) {
		message = message.replaceAll(key, value);
	}
	return message;
}

const SIZE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB'];

export function FormatBytes(bytes: number, allowFraction: boolean = false): string {
	let unitIndex = 0;
	while (bytes >= 1024 && unitIndex < (SIZE_UNITS.length - 1)) {
		if ((bytes % 1024) !== 0) {
			if (!allowFraction || bytes < 2048) {
				break;
			}
		}
		bytes /= 1024;
		unitIndex++;
	}
	// Round to 2 decimal digits if fractional
	if (allowFraction && !Number.isInteger(bytes)) {
		bytes = Math.floor(100 * bytes) / 100;
	}
	return `${bytes} ${SIZE_UNITS[unitIndex]}`;
}
