import classNames from 'classnames';
import { isEqual } from 'lodash-es';
import { Assert, AssetFrameworkPosePresetSchema, GetLogger, type AssetFrameworkPosePreset } from 'pandora-common';
import { useState, type ComponentType, type ReactElement } from 'react';
import * as z from 'zod';
import bodyIcon from '../../../assets/icons/body.svg';
import { DraggableDialog } from '../../../components/dialog/dialog.tsx';
import { ParseImportData } from '../../../components/exportImport/exportImportUtils.ts';
import './embeds.scss';

/**
 * A component for rendering a pose preset
 */
export function RenderedPosePreset({ value }: {
	value: string;
}): ReactElement {
	return (
		<RenderedPandoraImportEmbed
			value={ value }
			visibleName='pose preset'
			expectedType='PosePreset'
			expectedVersion={ 1 }
			dataSchema={ AssetFrameworkPosePresetSchema }
			Embed={ RenderedPosePresetInner }
		/>
	);
}

function RenderedPosePresetInner({ data }: {
	data: AssetFrameworkPosePreset;
}): ReactElement {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				className={ classNames(
					'ChatEmbed',
					open ? 'selected' : null,
				) }
				onClick={ () => setOpen(true) }
			>
				<img className='icon' src={ bodyIcon } alt='Quick posing' />
				Pose preset "{ data.name }"
			</button>
			{ open ? (
				<DraggableDialog
					title={ `Pose preset "${ data.name }"` }
					close={ () => {
						setOpen(false);
					} }
					allowShade
				>
					TODO
				</DraggableDialog>
			) : null }
		</>
	);
}

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
