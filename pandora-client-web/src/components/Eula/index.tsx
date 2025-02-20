import { ReactElement, useState } from 'react';
import { z } from 'zod';
import pandoraLogo from '../../assets/icons/pandora.svg';
import { useBrowserStorage } from '../../browserStorage';
import { ChildrenProps } from '../../common/reactTypes';
import { GAME_NAME } from '../../config/Environment';
import { Button } from '../common/button/button';
import { Column, Row } from '../common/container/container';
import { ModalDialog } from '../dialog/dialog';
import './eula.scss';
import { EULA_LAST_UPDATED, EULA_VERSION, PrivacyPolicyContent } from './privacyPolicy';

/**
 * Display the end user license agreement, with the option to accept it.
 */
export function Eula({ accept }: EulaProps): ReactElement {

	const [show, setShow] = useState(false);

	return (
		<div className='eula'>
			<Column className='fill-y'>
				<div className='flex-1' />
				<div className='eula-header'>
					<img src={ pandoraLogo } alt='Pandora Logo' />
				</div>
				<div className='eula-text'>
					<p>
						Welcome to { GAME_NAME }! This game is intended for use by adults only.<br />
						All characters portrayed in this game are fictitious and of legal age. No identification with actual persons should be inferred.
					</p>
					<p>
						By playing this game, you agree to the following:
					</p>
					<ul>
						<li>
							I am at least 18 years old and I have the legal right to possess adult material in my local community, state and/or country.
						</li>
						<li>
							I will not permit any minors to have access to any of the materials from this site.
						</li>
						<li>
							I have read { GAME_NAME }'s <a onClick={ () => setShow(true) } role='button'>privacy policy</a> and accept it. (Last updated on: { EULA_LAST_UPDATED })
						</li>
						<li>
							I have carefully read the above and agree to all of them.
						</li>
					</ul>
				</div>
				<Row padding='medium' className='eula-buttons' alignX='space-evenly'>
					<Button onClick={ EulaDisagree }>Disagree</Button>
					<Button onClick={ accept }>Agree ‣‣</Button>
				</Row>
				<div className='flex-2' />
			</Column>
			{ show && <PolicyDialog
				hide={ () => setShow(false) }
			/> }
		</div>
	);
}

function PolicyDialog({ hide }: {
	hide: () => void;
}): ReactElement {
	return (
		<ModalDialog contentOverflow='hidden'>
			<Column className='fit'>
				<div className='Scrollbar policyDetails flex-1'>
					<PrivacyPolicyContent />
				</div>
				<Row padding='medium' className='policyDetails-button' alignX='center'>
					<Button onClick={ hide }>Close</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function EulaGate({ children }: ChildrenProps): ReactElement {
	const [eula, setEula] = useBrowserStorage<number | undefined>('accepted-eula-version', undefined, z.number().optional());

	if (!eula || eula < EULA_VERSION) {
		return (
			<div className='main-container'>
				<div className='main'>
					<Eula accept={ () => setEula(EULA_VERSION) } />
				</div>
			</div>
		);
	}

	return (
		<>
			{ children }
		</>
	);
}

type EulaProps = {
	accept: () => void;
};

function EulaDisagree() {
	history.back();
	setTimeout(() => {
		window.location.href = 'about:blank';
	}, 100);
}
