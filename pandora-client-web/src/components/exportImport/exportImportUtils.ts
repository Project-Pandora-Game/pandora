import { isEqual } from 'lodash-es';
import { compressToBase64, decompressFromBase64 } from 'lz-string';
import { Assert } from 'pandora-common';

const EXPORT_FORMAT_TYPE_PREFIX = 'Pandora';
const EXPORT_FORMAT_VERSION = 1;

export function ExportData(data: unknown, exportType: string, exportVersion: number): string {
	const serialized = JSON.stringify(data);
	const compressed = compressToBase64(serialized);

	Assert(typeof compressed === 'string');

	const result = `${EXPORT_FORMAT_TYPE_PREFIX}${exportType}Begin:${EXPORT_FORMAT_VERSION}:${exportVersion}:${compressed}:${EXPORT_FORMAT_TYPE_PREFIX}${exportType}End`;

	// Validate data can be parsed again
	{
		const parseResult = ParseImportData(result);
		Assert(parseResult.success);
		Assert(parseResult.exportType === exportType);
		Assert(parseResult.exportVersion === exportVersion);
		Assert(isEqual(parseResult.data, JSON.parse(serialized)));
	}

	return result;
}

export function ParseImportData(data: string): {
	success: false;
	problem: string;
} | {
	success: true;
	exportType: string;
	exportVersion: number;
	data: unknown;
} {
	data = data.trim();
	if (!data) {
		return {
			success: false,
			problem: 'No data',
		};
	}

	let previousSeparatorIndex = 0;
	let separatorIndex = data.indexOf(':', previousSeparatorIndex);
	if (separatorIndex < 0 || !data.substring(0, separatorIndex).startsWith(EXPORT_FORMAT_TYPE_PREFIX) || !data.substring(0, separatorIndex).endsWith('Begin')) {
		return {
			success: false,
			problem: 'Unknown format (most likely not data exported from Pandora)',
		};
	}

	const exportType = data.substring(EXPORT_FORMAT_TYPE_PREFIX.length, separatorIndex - 'Begin'.length);

	const endExpectation = `:${EXPORT_FORMAT_TYPE_PREFIX}${exportType}End`;
	if (!data.endsWith(endExpectation)) {
		return {
			success: false,
			problem: 'Expected end not found',
		};
	}

	previousSeparatorIndex = separatorIndex + 1;
	separatorIndex = data.indexOf(':', previousSeparatorIndex);
	if (separatorIndex < 0 || !/^[0-9]+$/.test(data.substring(previousSeparatorIndex, separatorIndex))) {
		return {
			success: false,
			problem: 'Failed to read format version',
		};
	}

	const formatVersion = Number.parseInt(data.substring(previousSeparatorIndex, separatorIndex));
	Assert(Number.isInteger(formatVersion));

	if (formatVersion !== 1) {
		return {
			success: false,
			problem: `Unknown format version (found: ${formatVersion})`,
		};
	}

	previousSeparatorIndex = separatorIndex + 1;
	separatorIndex = data.indexOf(':', previousSeparatorIndex);
	if (separatorIndex < 0 || !/^[0-9]+$/.test(data.substring(previousSeparatorIndex, separatorIndex))) {
		return {
			success: false,
			problem: 'Failed to read format version',
		};
	}

	const exportVersion = Number.parseInt(data.substring(previousSeparatorIndex, separatorIndex));
	Assert(Number.isInteger(formatVersion));

	try {
		const compressedData = data.substring(separatorIndex + 1, data.length - endExpectation.length);
		const uncompressed = decompressFromBase64(compressedData);
		if (typeof uncompressed !== 'string') {
			throw new Error('Decompression failed');
		}

		const parsedData: unknown = JSON.parse(uncompressed);

		return {
			success: true,
			exportType,
			exportVersion,
			data: parsedData,
		};
	} catch (error) {
		return {
			success: false,
			problem: `Failed parse data (${String(error)})`,
		};
	}
}
