import { AssertNever } from 'pandora-common';
import type { SecondFactorData, SecondFactorResponse, SecondFactorType } from 'pandora-common/networking/api/directory_client';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useService } from '../../services/serviceProvider.tsx';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
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
	const [state, setState] = useState<SecondFactorState | null>(null);

	const secondFactorHandler = useCallback((response: SecondFactorResponse) => {
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

	useEffect(() => {
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
	const [captcha, setCaptcha] = useState('');

	const elements = useMemo(() => types.map((type) => {
		switch (type) {
			case 'captcha':
				return (
					<FormFieldCaptcha key='captcha'
						setCaptchaToken={ setCaptcha }
						invalidCaptcha={ invalid != null && invalid.includes('captcha') }
					/>
				);
			default:
				AssertNever(type);
		}
	}), [types, invalid, setCaptcha]);

	const onSubmit = useCallback(() => {
		const data: SecondFactorData = {};
		if (types.includes('captcha')) {
			data.captcha = captcha;
		}
		resolve(data);
	}, [types, captcha, resolve]);

	const onCancel = useCallback(() => {
		resolve(null);
	}, [resolve]);

	useEffect(() => {
		// Auto-submit on captcha confirmation
		if (types.length === 1 && types.includes('captcha') && captcha) {
			onSubmit();
		}
	}, [types, captcha, onSubmit]);

	return (
		<ModalDialog>
			<Form onSubmit={ onSubmit }>
				<Column gap='large'>
					<h3>Second factor required</h3>
					{ elements }
					<Row alignX='space-between'>
						<Button onClick={ onCancel }>Cancel</Button>
						<Button type='submit'>Submit</Button>
					</Row>
				</Column>
			</Form>
		</ModalDialog>
	);
}
