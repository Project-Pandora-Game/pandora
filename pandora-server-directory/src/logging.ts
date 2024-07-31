import type { RESTPostAPIWebhookWithTokenJSONBody } from 'discord-api-types/v10';
import fsPromises from 'fs/promises';
import { AnyToString, GetLogger, logConfig, LogLevel } from 'pandora-common';

export const AUDIT_LOG = GetLogger('audit', '[Audit]');

export async function AddFileOutput(fileName: string, append: boolean, logLevel: LogLevel | false, logLevelOverrides: Record<string, LogLevel | false> = {}): Promise<void> {
	const writeStream = (await fsPromises.open(fileName, append ? 'a' : 'w'))
		.createWriteStream({
			encoding: 'utf8',
		});
	logConfig.logOutputs.push({
		logLevel,
		logLevelOverrides,
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
