import fs from 'fs';
import { logConfig, LogLevel } from 'pandora-common/dist/logging';

/** Custom function for stringifying data when logging into file */
function AnyToString(data: unknown): string {
	if (typeof data === 'string') {
		return data;
	}

	if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
		if (data instanceof Error) {
			return data.stack ? `[${data.stack}\n]` : `[Error ${data.name}: ${data.message}]`;
		}
		const customString = String(data);
		if (customString !== '[object Object]') {
			return customString;
		}
	}

	return (
		JSON.stringify(data, (_k, v) => {
			if (typeof v === 'object' && v !== null && v !== data) {
				return Array.isArray(v) ? '[object Array]' : String(v);
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return v;
		}) ?? 'undefined'
	);
}

export function AddFileOutput(fileName: string, append: boolean, logLevel: LogLevel, logLevelOverrides: Record<string, LogLevel> = {}): void {
	const fd = fs.openSync(fileName, append ? 'a' : 'w');
	logConfig.logOutputs.push({
		logLevel,
		logLevelOverrides,
		supportsColor: false,
		onMessage: (prefix, message) => {
			const line = [prefix, ...message.map((v) => AnyToString(v))].join(' ') + '\n';
			fs.writeSync(fd, line, undefined, 'utf8');
		},
	});
}
