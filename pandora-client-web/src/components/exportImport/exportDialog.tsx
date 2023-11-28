import React, { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import { Button } from '../common/button/button';
import { ZodType, z } from 'zod';
import { CloneDeepMutable, GetLogger } from 'pandora-common';
import { ExportData } from './exportImportUtils';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import './exportDialog.scss';
import { useCurrentTime } from '../../common/useCurrentTime';

interface ExportDialogProps<T extends ZodType<unknown>> {
	exportType: string;
	exportVersion: number;
	dataSchema: T;
	data: z.infer<T>;
	closeDialog: () => void;
}

const logger = GetLogger('ExportImport');

const COPY_SUCCESS_COOLDOWN = 3_000;

export function ExportDialog<T extends ZodType<unknown>>({
	exportType,
	exportVersion,
	dataSchema,
	data,
	closeDialog,
}: ExportDialogProps<T>): ReactElement {
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const [lastCopySuccess, setLastCopySuccess] = useState(0);
	const now = useCurrentTime(200);

	const validatedExportData = useMemo(() => {
		const parseResult = dataSchema.safeParse(CloneDeepMutable(data));
		if (!parseResult.success) {
			logger.error('Attempt to export invalid data', exportType, parseResult.error, data);
			throw new Error('Attempt to export invalid data');
		}
		return parseResult.data;
	}, [dataSchema, data, exportType]);

	const exportString = useMemo<string>(() => ExportData(validatedExportData, exportType, exportVersion), [validatedExportData, exportType, exportVersion]);

	const [downloadFileName, setDownloadFileName] = useState<string>(() => {
		const time = new Date();
		const timestring = time.getFullYear().toString() +
			'_' + (time.getMonth() + 1).toString().padStart(2, '0') +
			'_' + time.getDate().toString().padStart(2, '0') +
			'_' + time.getHours().toString().padStart(2, '0') +
			'_' + time.getMinutes().toString().padStart(2, '0');
		return `pandora_${exportType.toLocaleLowerCase()}_${timestring}.txt`;
	});

	const downloadAsFile = useCallback(() => {
		if (!downloadFileName.trim())
			return;
		const element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(exportString));
		element.setAttribute('download', downloadFileName.trim());
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	}, [downloadFileName, exportString]);

	const copyToClipboard = useCallback(() => {
		function copyFallback() {
			const textArea = textAreaRef.current;
			if (textArea == null)
				return;

			textArea.focus();
			textArea.select();

			try {
				const successful = document.execCommand('copy');
				if (successful) {
					setLastCopySuccess(Date.now());
				} else {
					logger.warning(`Failed to copy text with returned error by execCommand`);
					toast(`Failed to copy the text, please copy it manually.`, TOAST_OPTIONS_ERROR);
				}
			} catch (err) {
				logger.warning(`Failed to copy text with error:`, err);
				toast(`Failed to copy the text, please copy it manually.`, TOAST_OPTIONS_ERROR);
			}
		}

		if (!navigator.clipboard) {
			copyFallback();
			return;
		}
		navigator.clipboard.writeText(exportString)
			.then(() => {
				setLastCopySuccess(Date.now());
			})
			.catch((err) => {
				logger.warning(`Failed to write text with error:`, err);
				// Try fallback
				copyFallback();
			});
	}, [exportString]);

	return (
		<ModalDialog>
			<Column className='exportDialogContent'>
				<fieldset>
					<legend>Download as file</legend>
					<Row>
						<input className='flex-1' value={ downloadFileName } onChange={ (e) => setDownloadFileName(e.target.value) } />
						<Button
							className='slim fadeDisabled'
							onClick={ downloadAsFile }
						>
							Download
						</Button>
					</Row>
				</fieldset>
				<Button onClick={ copyToClipboard }>
					{ now < (lastCopySuccess + COPY_SUCCESS_COOLDOWN) ? 'Copied!' : 'Copy to clipboard' }
				</Button>
				<textarea
					ref={ textAreaRef }
					value={ exportString }
					readOnly
					style={ {
						wordBreak: 'break-all',
					} }
					rows={ 4 }
				/>
				<Row padding='medium' alignX='center'>
					<Button onClick={ closeDialog }>Close</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
