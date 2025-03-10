import {
	AssertNever,
	SecondFactorData,
	SecondFactorResponse,
	SecondFactorType,
} from 'pandora-common';
import React, { ReactElement } from 'react';
import { useService } from '../../services/serviceProvider.tsx';
import { Button } from '../common/button/button.tsx';
import { Row } from '../common/container/container.tsx';
import { Form } from '../common/form/form.tsx';
import { FormFieldCaptcha } from '../common/form/formFieldCaptcha.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';

type SecondFactorState = {
	types: SecondFactorType[];
	invalid: SecondFactorType[] | null;
	resolve: (data: SecondFactorData | PromiseLike<SecondFactorData> | null) => void;
	reject: (reason?: Error) => void;
};

export function SecondFactorProvider() {
	const accountManager = useService('accountManager');
	const [state, setState] = React.useState<SecondFactorState | null>(null);

	const secondFactorHandler = React.useCallback((response: SecondFactorResponse) => {
		return new Promise<SecondFactorData | null>((resolve, reject) => {
			setState({
				types: response.types,
				invalid: response.result === 'secondFactorInvalid' ? response.invalid : null,
				resolve,
				reject,
			});
		}).finally(() => {
			setState(null);
		});
	}, [setState]);

	React.useEffect(() => {
		accountManager.secondFactorHandler = secondFactorHandler;
		return () => {
			state?.resolve(null);
			accountManager.secondFactorHandler = null;
		};
	}, [accountManager, state, secondFactorHandler]);

	if (state == null) {
		return null;
	}

	return <SecondFactorDialogImpl { ...state } />;
}

function SecondFactorDialogImpl({ types, invalid, resolve }: SecondFactorState): ReactElement {
	const [captcha, setCaptcha] = React.useState('');

	const elements = React.useMemo(() => types.map((type) => {
		switch (type) {
			case 'captcha':
				return <FormFieldCaptcha key='captcha' setCaptchaToken={ setCaptcha } invalidCaptcha={ invalid != null && invalid.includes('captcha') } />;
			default:
				AssertNever(type);
		}
	}), [types, invalid, setCaptcha]);

	const onSubmit = React.useCallback(() => {
		const data: SecondFactorData = {};
		if (types.includes('captcha')) {
			data.captcha = captcha;
		}
		resolve(data);
	}, [types, captcha, resolve]);

	const onCancel = React.useCallback(() => {
		resolve(null);
	}, [resolve]);

	return (
		<ModalDialog>
			<Form onSubmit={ onSubmit }>
				<h3>Second factor required</h3>
				{ elements }
				<Row>
					<Button type='submit'>Submit</Button>
					<Button onClick={ onCancel }>Cancel</Button>
				</Row>
			</Form>
		</ModalDialog>
	);
}
