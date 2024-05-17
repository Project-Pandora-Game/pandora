import React, { Suspense, type ReactElement } from 'react';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { useObservable } from '../../../observable';
import { FormField, FormFieldError } from './form';

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

	const clear = React.useCallback(() => {
		setCaptchaToken('');
	}, [setCaptchaToken]);

	if (!captchaSiteKey) {
		return null;
	}

	return (
		<FormField>
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
				/>
				<FormFieldError error={ invalidCaptcha ? { type: 'invalidCaptcha', message: 'Invalid captcha' } : undefined } />
			</Suspense>
		</FormField>
	);
}
