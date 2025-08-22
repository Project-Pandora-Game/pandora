import { GetLogger } from 'pandora-common';
import { useCallback, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import shareIcon from '../../../assets/icons/share.svg';
import { Button } from '../../../components/common/button/button.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';

interface ShareButtonProps {
	shareData: ShareData;
	className?: string;
}

export function ShareButton({ shareData, className }: ShareButtonProps): ReactElement | null {
	const share = useCallback(() => {
		globalThis.navigator.share(shareData)
			.catch((err) => {
				// Ignore user aborting
				if (err instanceof DOMException && err.name === 'AbortError')
					return;

				GetLogger('ShareButton').error('Error sharing:', err);
				toast(`Error while sharing: ${ err }`, TOAST_OPTIONS_ERROR);
			});
	}, [shareData]);

	if (typeof globalThis.navigator.share !== 'function' ||
		typeof globalThis.navigator.canShare !== 'function' ||
		!globalThis.navigator.canShare(shareData)
	) {
		return null;
	}

	return (
		<Button className={ className } onClick={ share }>
			<img src={ shareIcon } alt='share' />
			Share
		</Button>
	);
}
