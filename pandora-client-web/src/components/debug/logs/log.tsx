import classNames from 'classnames';
import { LogLevel } from 'pandora-common';
import type { ReactNode } from 'react';
import './log.scss';

const LOG_LEVEL_TO_CLASS: Record<LogLevel, string> = {
	[LogLevel.FATAL]: 'loglevel-fatal',
	[LogLevel.ERROR]: 'loglevel-error',
	[LogLevel.WARNING]: 'loglevel-warning',
	[LogLevel.ALERT]: 'loglevel-alert',
	[LogLevel.INFO]: 'loglevel-info',
	[LogLevel.VERBOSE]: 'loglevel-verbose',
	[LogLevel.DEBUG]: 'loglevel-debug',
};

export function LogItem({ logLevel, children }: {
	logLevel: LogLevel;
	children: ReactNode;
}): ReactNode {
	return (
		<div className={ classNames(
			'LogItem',
			LOG_LEVEL_TO_CLASS[logLevel],
		) }>
			{ children }
		</div>
	);
}
