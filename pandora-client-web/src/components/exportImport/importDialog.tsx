import { isEqual } from 'lodash-es';
import { Assert, GetLogger } from 'pandora-common';
import { ReactElement, useEffect, useId, useState } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { ParseImportData } from './exportImportUtils.ts';
import './importDialog.scss';

interface ImportDialogProps<T extends z.ZodType> extends ChildrenProps {
	expectedType: string;
	expectedVersion: number;
	dataSchema: T;
	migration?: Partial<Record<number, (oldData: unknown) => { migratedVersion: number; migratedData: unknown; }>>;
	onImport: (data: z.infer<T>) => void;
	closeDialog: () => void;
}

const logger = GetLogger('ExportImport');

export function ImportDialog<T extends z.ZodType>({
	expectedType,
	expectedVersion,
	dataSchema,
	migration,
	children,
	onImport,
	closeDialog,
}: ImportDialogProps<T>): ReactElement {
	const [importText, setImportText] = useState('');
	const [importProblem, setImportProblem] = useState<string | null>('Loading...');

	useEffect(() => {
		const pasteHandler = (ev: ClipboardEvent) => {
			ev.preventDefault();
			ev.stopImmediatePropagation();
			const data = ev.clipboardData?.getData('text');

			if (typeof data === 'string') {
				setImportText(data);
			}
		};

		document.addEventListener('paste', pasteHandler);

		return () => {
			document.removeEventListener('paste', pasteHandler);
		};
	}, []);

	useEffect(() => {
		const parsedImport = ParseImportData(importText);

		if (!parsedImport.success) {
			setImportProblem(parsedImport.problem);
			return;
		}

		if (parsedImport.exportType !== expectedType) {
			setImportProblem(`Unexpected import type (found: ${parsedImport.exportType}, expected: ${expectedType})`);
			return;
		}

		let data = parsedImport.data;
		let dataVersion = parsedImport.exportVersion;

		while (dataVersion !== expectedVersion) {
			const migrationFunction = migration?.[dataVersion];
			if (migrationFunction == null) {
				setImportProblem(`Unsupported version (found: ${parsedImport.exportVersion}, supported versions: ${[...Object.keys(migration ?? {}), expectedVersion.toString()].join(', ')})`);
				return;
			}

			try {
				const migrationResult = migrationFunction(data);
				Assert(migrationResult.migratedVersion > dataVersion);
				data = migrationResult.migratedData;
				dataVersion = migrationResult.migratedVersion;
			} catch (error) {
				logger.warning(`Migration from version ${dataVersion} errored:`, error);
				setImportProblem(`Version migration failed: ${String(error)}`);
				return;
			}
		}

		const parsedData = dataSchema.safeParse(data);
		if (!parsedData.success) {
			setImportProblem(`Loading data failed:\n${z.prettifyError(parsedData.error)}`);
			return;
		}

		if (!isEqual(parsedData.data, data)) {
			// TODO: Report warnings about implicit migration
		}

		setImportProblem('Importing...');
		onImport(parsedData.data);
	}, [dataSchema, expectedType, expectedVersion, importText, migration, onImport]);

	const importInputId = useId();

	return (
		<ModalDialog>
			<Column className='importDialogContent'>
				{ children }
				<fieldset>
					<legend>Import status</legend>
					<Row alignY='center'>
						<span className='display-linebreak'>
							{ importProblem == null ? 'Valid import!' : importProblem }
						</span>
					</Row>
				</fieldset>
				<label htmlFor={ importInputId } className='flex-1 hiddenUpload'>
					{ /* eslint-disable-next-line react/forbid-elements */ }
					<input
						accept='text/plain'
						id={ importInputId }
						type='file'
						onChange={ (e) => {
							const files = e.target.files;
							if (files && files.length === 1) {
								const file = files.item(0);
								if (!file) {
									e.target.value = '';
									return;
								}
								file
									.text()
									.then((content) => {
										setImportText(content);
									})
									.catch((err) => {
										logger.error('Failed to load file:', err);
										toast(`Loading file failed:\n${String(err)}`, TOAST_OPTIONS_ERROR);
									})
									.finally(() => {
										// Clear files after load so user can re-select same one easily
										e.target.value = '';
									});
							}
						} }
					/>
					<span className='Button default'>
						Import from file
					</span>
				</label>
				<span>Press Ctrl+V or paste the data in the box below.</span>
				<textarea
					value={ importText }
					onChange={ (ev) => {
						setImportText(ev.target.value);
					} }
					style={ {
						wordBreak: 'break-all',
					} }
					rows={ 4 }
				/>
				<Row padding='medium' alignX='center'>
					<Button onClick={ closeDialog }>Cancel</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
