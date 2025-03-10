import React, { Suspense, type ReactElement } from 'react';
import { useObservable } from '../../../observable.ts';
import { useIsVeryNarrowScreen } from '../../../styles/mediaQueries.ts';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { FormField, FormFieldError } from './form.tsx';

const HCaptcha = React.lazy(() => import('@hcaptcha/react-hcaptcha'));

export function FormFieldCaptcha({
	setCaptchaToken,
	invalidCaptcha,
}: {
	setCaptchaToken: (token: string) => void;
	invalidCaptcha: boolean;
}): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const captchaSiteKey = useObservable(directoryConnector.directoryStatus).captchaSiteKey;
	const isVeryNarrowScreen = useIsVeryNarrowScreen();

	const clear = React.useCallback(() => {
		setCaptchaToken('');
	}, [setCaptchaToken]);

	if (!captchaSiteKey) {
		return null;
	}

	return (
		<FormField className='captcha'>
			<Suspense fallback={ (
				<span>Loading captcha...</span>
			) }>
				<HCaptcha
					sitekey={ captchaSiteKey }
					onVerify={ setCaptchaToken }
					onExpire={ clear }
					onError={ clear }
					reCaptchaCompat={ false }
					theme='dark'
					size={ isVeryNarrowScreen ? 'compact' : 'normal' }
					sentry={ false }
				/>
				<FormFieldError error={ invalidCaptcha ? { type: 'invalidCaptcha', message: 'Invalid captcha' } : undefined } />
			</Suspense>
		</FormField>
	);
}
