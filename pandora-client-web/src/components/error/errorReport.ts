import bowser from 'bowser';
import { IsNotNullable } from 'pandora-common';
import { isWebGLSupported, isWebGPUSupported } from 'pixi.js';
import { ErrorInfo } from 'react';
import { GAME_VERSION } from '../../config/Environment.ts';
import { DirectoryConnectionState } from '../../networking/directoryConnector.ts';
import { ShardConnectionState } from '../../networking/shardConnector.ts';
import { DebugData } from './debugContextProvider.tsx';

interface ReportSection {
	heading: string;
	details: string;
}

export const MAX_ERROR_STACK_LINES = 20;

export function BuildErrorReport(error: unknown, errorInfo: ErrorInfo | undefined, debugData: DebugData | undefined): string {
	try {
		const report = [
			BuildStackTraceSection(error),
			BuildComponentStackSection(errorInfo),
			debugData != null ? BuildDirectoryDataSection(debugData) : null,
			debugData != null ? BuildShardDataSection(debugData) : null,
			BuildDiagnosticsSection(),
			BuildDeviceSection(),
		]
			.filter(IsNotNullable)
			.map(DisplayReportSection)
			.join('\n\n');
		return '```\n' + report + '\n```';
	} catch (_error) {
		try {
			return `${String(error)}\n${JSON.stringify(errorInfo)}\n${String(JSON.stringify(debugData))}`;
		} catch (_error2) {
			return `${String(error)}\n[ERROR SERIALIZING EXTRA DATA]`;
		}
	}
}

function BuildStackTraceSection(error: unknown): ReportSection {
	let details: string;
	if (error instanceof Error && error.stack) {
		const errorSummary = `${error.name}: ${error.message}`;
		const stack = TruncateStack(error.stack);
		if (!stack.startsWith(errorSummary)) {
			details = `${errorSummary}\n${stack}`;
		} else {
			details = stack;
		}
	} else {
		details = String(error);
	}
	return { heading: 'Error Stack', details };
}

function BuildComponentStackSection(errorInfo?: ErrorInfo): ReportSection {
	const details = TruncateStack(errorInfo?.componentStack ?? '').replace(/^\s*/, '');
	return { heading: 'Component Stack', details };
}

function BuildDirectoryDataSection(debugData: DebugData): ReportSection {
	let details = '';
	if (debugData) {
		if (debugData.editor) {
			return { heading: 'Editor', details: 'Editor is running' };
		}
		const { directoryState, directoryStatus } = debugData;
		details += `Directory state: ${directoryState ? DirectoryConnectionState[directoryState] : 'unknown'}\n`;
		details += 'Directory status:';
		let directoryStatusString: string;
		try {
			directoryStatusString = JSON.stringify(directoryStatus, null, 4);
		} catch (_) {
			directoryStatusString = '[ERROR]';
		}
		details += directoryStatusString ? `\n${directoryStatusString}` : ' unavailable';
	}
	return { heading: 'Directory Information', details };
}

function BuildShardDataSection(debugData: DebugData): ReportSection {
	let details = '';
	if (debugData) {
		const { shardState, shardConnectionInfo } = debugData;
		details += `Shard state: ${shardState ? ShardConnectionState[shardState] : 'unknown'}\n`;
		details += 'Shard connection information:';
		let connectionInfoString: string;
		try {
			connectionInfoString = JSON.stringify(shardConnectionInfo, null, 4);
		} catch (_) {
			connectionInfoString = '[ERROR]';
		}
		details += connectionInfoString ? `\n${connectionInfoString}` : ' unavailable';
	}
	return { heading: 'Shard Information', details };
}

function BuildDiagnosticsSection(): ReportSection {
	const details = [
		`Location: ${window.location.href}`,
		`User agent: ${window.navigator.userAgent}`,
		`Game version: ${GAME_VERSION}`,
		`Local time: ${new Date().toISOString()}`,
		`WebGL supported: ${String(isWebGLSupported())}`,
		// FIXME: Think about how to resolve this promise
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		`WebGPU supported: ${String(isWebGPUSupported())}`,
	].join('\n');
	return { heading: 'Additional Diagnostics', details };
}

function BuildDeviceSection(): ReportSection {
	return { heading: 'Device details', details: JSON.stringify(bowser.parse(window.navigator.userAgent), null, 4) };
}

function TruncateStack(stack: string): string {
	let lines = stack.split('\n');
	const fullStackSize = lines.length;
	if (fullStackSize > MAX_ERROR_STACK_LINES) {
		lines = lines.slice(0, MAX_ERROR_STACK_LINES);
		lines.push(`    ...and ${fullStackSize - MAX_ERROR_STACK_LINES} more`);
	}
	return lines.join('\n');
}

function DisplayReportSection({ heading, details }: ReportSection): string {
	const headingDecoration = '-'.repeat(heading.length);
	return `${headingDecoration}\n${heading}\n${headingDecoration}\n${details}`;
}
