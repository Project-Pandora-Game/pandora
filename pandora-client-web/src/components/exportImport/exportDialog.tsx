import { CloneDeepMutable, EMPTY_ARRAY, GetLogger } from 'pandora-common';
import { ReactElement, Suspense, use, useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ZodType, z } from 'zod';
import { CopyToClipboard } from '../../common/clipboard.ts';
import { DownloadAsFile } from '../../common/downloadHelper.ts';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import './exportDialog.scss';
import { ExportData } from './exportImportUtils.ts';

export type ExportDialogTarget = {
	suffix: string;
	content: Blob | string;
	type: string;
};

interface ExportDialogProps<T extends ZodType<unknown>> {
	title: string;
	exportType: string;
	exportVersion: number;
	dataSchema: T;
	data: z.infer<T>;
	extraData?: Promise<readonly ExportDialogTarget[]>;
	closeDialog: () => void;
}

const logger = GetLogger('ExportImport');

const COPY_SUCCESS_COOLDOWN = 3_000;

export function ExportDialog<T extends ZodType<unknown>>({
	closeDialog,
	...props
}: ExportDialogProps<T>): ReactElement {

	return (
		<ModalDialog>
			<Column className='exportDialogContent'>
				<Suspense fallback={ <strong>Loading...</strong> }>
					<ExportDialogInner
						{ ...props }
					/>
				</Suspense>
				<Row padding='medium' alignX='center'>
					<Button onClick={ closeDialog }>Close</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function ExportDialogInner<T extends ZodType<unknown>>({
	title,
	exportType,
	exportVersion,
	dataSchema,
	data,
	extraData: extraDataPromise,
}: Omit<ExportDialogProps<T>, 'closeDialog'>): ReactElement {
	const account = useCurrentAccount();
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);
	const showCopyClearTimeout = useRef<number>(null);

	const extraData = extraDataPromise != null ? use(extraDataPromise) : EMPTY_ARRAY;

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
		return `pandora_${exportType.toLocaleLowerCase()}_${timestring}`;
	});

	const downloadAsFile = useCallback((target?: ExportDialogTarget) => {
		if (!downloadFileName.trim())
			return;

		target ??= {
			content: exportString,
			suffix: '.txt',
			type: 'text/plain;charset=utf-8',
		};
		if (typeof target.content === 'string') {
			DownloadAsFile(target.content, downloadFileName.trim() + target.suffix, target.type);
		} else {
			DownloadAsFile(target.content, downloadFileName.trim() + target.suffix);
		}
	}, [downloadFileName, exportString]);

	const copyToClipboard = useCallback(() => {
		CopyToClipboard(exportString, () => {
			if (showCopyClearTimeout.current != null) {
				clearTimeout(showCopyClearTimeout.current);
			}
			setShowCopySuccess(true);
			showCopyClearTimeout.current = setTimeout(() => {
				setShowCopySuccess(false);
			}, COPY_SUCCESS_COOLDOWN);
		});
	}, [exportString]);

	const shareData = useMemo((): ShareData => {
		return {
			title: `Project Pandora ${title}` + (account != null ? ` by ${ account.displayName }` : ''),
			files: [
				new File([exportString], `${downloadFileName.trim() || 'export'}.txt`, { type: 'text/plain;charset=utf-8' }),
				...extraData.map((d) => new File([d.content], (downloadFileName.trim() || 'export') + d.suffix, { type: d.type })),
			],
		};
	}, [account, downloadFileName, exportString, extraData, title]);

	return (
		<>
			<h2>Export { title }</h2>
			<fieldset>
				<legend>Download as file</legend>
				<Column>
					<TextInput value={ downloadFileName } onChange={ setDownloadFileName } />
					<Row alignY='center'>
						<span className='flex-1'>{ `${downloadFileName}.txt` }</span>
						<Button
							className='slim'
							onClick={ () => downloadAsFile() }
						>
							<u>⇣</u> Download
						</Button>
					</Row>
					{ extraData.map((d, i) => (
						<Row key={ i } alignY='center'>
							<span className='flex-1'>{ `${downloadFileName}${d.suffix}` }</span>
							<Button
								className='slim'
								onClick={ () => downloadAsFile(d) }
							>
								<u>⇣</u> Download
							</Button>
						</Row>
					)) }
				</Column>
			</fieldset>
			<Row>
				<Button className='flex-1' onClick={ copyToClipboard }>
					{ showCopySuccess ? 'Copied!' : 'Copy to clipboard' }
				</Button>
				{ typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData) ? (
					<Button className='flex-1' onClick={ () => {
						navigator.share(shareData)
							.catch((err) => {
								GetLogger('ExportDialog').error('Error sharing:', err);
								toast('Error while sharing', TOAST_OPTIONS_ERROR);
							});
					} }>
						Share
					</Button>
				) : null }
			</Row>
			<textarea
				ref={ textAreaRef }
				value={ exportString }
				readOnly
				style={ {
					wordBreak: 'break-all',
				} }
				rows={ 4 }
			/>
		</>
	);
}
