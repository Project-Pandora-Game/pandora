import { isEqual } from 'lodash-es';
import { Assert, GetLogger } from 'pandora-common';
import { type ComponentType, type ReactElement } from 'react';
import * as z from 'zod';
import { ParseImportData } from '../../../components/exportImport/exportImportUtils.ts';
import './embeds.scss';

export function RenderedPandoraImportEmbed<T extends z.ZodType>({ value, visibleName, expectedType, expectedVersion, dataSchema, migration, Embed }: {
	value: string;

	visibleName: string;
	expectedType: string;
	expectedVersion: number;
	dataSchema: T;
	migration?: Partial<Record<number, (oldData: unknown) => { migratedVersion: number; migratedData: unknown; }>>;

	// eslint-disable-next-line @typescript-eslint/naming-convention
	Embed: ComponentType<{ data: z.infer<T>; }>;
}): ReactElement {
	const parsedImport = ParseImportData(value);

	if (!parsedImport.success) {
		return (
			<>
				<span>
					{ value }
				</span>
				<div className='ChatEmbedText error'>Invalid { visibleName }: { parsedImport.problem }.</div>
			</>
		);
	}

	if (parsedImport.exportType !== expectedType) {
		return (
			<>
				<span>
					{ value }
				</span>
				<div className='ChatEmbedText error'>Invalid { visibleName }: Unexpected import type (found: { parsedImport.exportType }, expected: { expectedType })</div>
			</>
		);
	}

	let data = parsedImport.data;
	let dataVersion = parsedImport.exportVersion;

	while (dataVersion !== expectedVersion) {
		const migrationFunction = migration?.[dataVersion];
		if (migrationFunction == null) {
			return (
				<>
					<span>
						{ value }
					</span>
					<div className='ChatEmbedText error'>Invalid { visibleName }: Unsupported version (found: { parsedImport.exportVersion }, supported versions: { [...Object.keys(migration ?? {}), expectedVersion.toString()].join(', ') })</div>
				</>
			);
		}

		try {
			const migrationResult = migrationFunction(data);
			Assert(migrationResult.migratedVersion > dataVersion);
			data = migrationResult.migratedData;
			dataVersion = migrationResult.migratedVersion;
		} catch (error) {
			GetLogger('RenderedPandoraImportEmbed').warning(`Migration from version ${dataVersion} errored:`, error);
			return (
				<>
					<span>
						{ value }
					</span>
					<div className='ChatEmbedText error'>Invalid { visibleName }: Version migration failed: { String(error) }</div>
				</>
			);
		}
	}

	const parsedData = dataSchema.safeParse(data);
	if (!parsedData.success) {
		return (
			<>
				<span>
					{ value }
				</span>
				<div className='ChatEmbedText error'>Invalid { visibleName }: Loading data failed:<br />{ z.prettifyError(parsedData.error) }</div>
			</>
		);
	}

	if (!isEqual(parsedData.data, data)) {
		// TODO: Report warnings about implicit migration
	}

	return (
		<Embed
			data={ parsedData.data }
		/>
	);
}
