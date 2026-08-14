import { GetLogger } from 'pandora-common';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { Button } from '../components/common/button/button.tsx';
import { TOAST_OPTIONS_ERROR } from '../persistentToast.ts';
import type { CommonProps } from './reactTypes.ts';

const COPY_SUCCESS_COOLDOWN = 3_000;

const logger = GetLogger('Clipboard');

export function CopyToClipboard(text: string, onSuccess?: () => void, onError?: () => void): void {
	function copyFallback() {
		const textArea = document.createElement('textarea');
		textArea.value = text;

		// Avoid scrolling to bottom
		textArea.style.top = '0';
		textArea.style.left = '0';
		textArea.style.position = 'fixed';

		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		let successful = false;

		try {
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			successful = document.execCommand('copy');
			if (!successful) {
				logger.warning(`Failed to copy text with returned error by execCommand`);
			}
		} catch (err) {
			logger.warning(`Failed to copy text with error:`, err);
		}

		document.body.removeChild(textArea);

		if (successful) {
			onSuccess?.();
		} else {
			toast(`Failed to copy the text, please copy it manually.`, TOAST_OPTIONS_ERROR);
			onError?.();
		}
	}

	if (!navigator.clipboard) {
		copyFallback();
		return;
	}

	navigator.clipboard.writeText(text)
		.then(() => {
			onSuccess?.();
		})
		.catch((err) => {
			logger.warning(`Failed to write text with error:`, err);
			// Try fallback
			copyFallback();
		});
}

export function CopyToClipboardButton({ text, buttonText, ...props }: CommonProps & {
	text: string;
	buttonText?: string;
}): ReactElement {
	const [showCopySuccess, setShowCopySuccess] = useState(false);
	const showCopyClearTimeout = useRef<number>(null);

	const copyToClipboard = useCallback(() => {
		CopyToClipboard(text, () => {
			if (showCopyClearTimeout.current != null) {
				clearTimeout(showCopyClearTimeout.current);
			}
			setShowCopySuccess(true);
			showCopyClearTimeout.current = setTimeout(() => {
				setShowCopySuccess(false);
			}, COPY_SUCCESS_COOLDOWN);
		});
	}, [text]);

	return (
		<Button { ...props } onClick={ copyToClipboard }>
			{ showCopySuccess ? 'Copied!' : buttonText }
		</Button>
	);
}
