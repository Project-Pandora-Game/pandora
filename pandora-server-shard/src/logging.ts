import type { RESTPostAPIWebhookWithTokenJSONBody } from 'discord-api-types/v10';
import fsPromises from 'fs/promises';
import { GetLogger, logConfig, LogLevel } from 'pandora-common';

/** Custom function for stringifying data when logging into file */
export function AnyToString(data: unknown): string {
	if (typeof data === 'string') {
		return data;
	}

	if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
		if (data instanceof Error) {
			return data.stack ? `[${data.stack}\n]` : `[Error ${data.name}: ${data.message}]`;
		}
		if ('toString' in data) {
			const customString = String(data);
			if (customString !== '[object Object]') {
				return customString;
			}
		} else {
			return '[object null]';
		}
	}

	return (
		JSON.stringify(data, (_k, v) => {
			if (typeof v === 'object' && v !== null && v !== data) {
				if (Array.isArray(v))
					return '[object Array]';
				if ('toString' in v)
					return String(v);
				return '[object null]';
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return v;
		}) ?? 'undefined'
	);
}

export async function AddFileOutput(fileName: string, append: boolean, logLevel: LogLevel, exactLevel: boolean = false, logLevelOverrides: Record<string, LogLevel> = {}): Promise<void> {
	const writeStream = (await fsPromises.open(fileName, append ? 'a' : 'w'))
		.createWriteStream({
			encoding: 'utf8',
		});
	logConfig.logOutputs.push({
		logLevel,
		logLevelOverrides,
		exactLevel,
		supportsColor: false,
		onMessage: (prefix, message) => {
			const line = [prefix, ...message.map((v) => AnyToString(v))].join(' ') + '\n';
			writeStream.write(line, 'utf8');
		},
		flush: () => {
			return new Promise((resolve, reject) => {
				writeStream.write('', (error) => {
					if (error != null) {
						reject(error);
					}
					resolve();
				});
			});
		},
	});
}

export function AddDiscordLogOutput(name: string, webhookUrl: string, logLevel: LogLevel, logLevelOverrides: Record<string, LogLevel> = {}): void {
	const LOG_COLORS: Record<LogLevel, number> = {
		[LogLevel.FATAL]: 0x581845,
		[LogLevel.ERROR]: 0xC70039,
		[LogLevel.AUDIT]: 0x800080,
		[LogLevel.WARNING]: 0xFF5733,
		[LogLevel.ALERT]: 0xFFC300,
		[LogLevel.INFO]: 0xFFFFFF,
		[LogLevel.VERBOSE]: 0x08C43A,
		[LogLevel.DEBUG]: 0x0C71C4,
	};
	let suspend: boolean = false;

	const logger = GetLogger('Discord');

	logConfig.logOutputs.push({
		logLevel,
		logLevelOverrides,
		supportsColor: false,
		onMessage: (prefix, message, level) => {
			if (suspend)
				return;

			const request: RESTPostAPIWebhookWithTokenJSONBody = {
				embeds: [{
					author: {
						name,
					},
					color: LOG_COLORS[level] ?? 0xFFC300,
					title: prefix,
					description: `\`\`\`\n${message.map((v) => AnyToString(v)).join(' ')}\n\`\`\``,
				}],
			};
			fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(request),
			}).catch((err) => {
				suspend = true;
				logger.error('Failed to send discord webhook error', err);
				suspend = false;
			});
		},
	});
}
