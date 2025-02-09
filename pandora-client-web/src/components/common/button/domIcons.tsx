import { ReactElement } from 'react';
import './domIcons.scss';

export function IconHamburger({ state }: {
	state: 'hamburger' | 'cross';
}): ReactElement {
	return (
		<div className={ `icon-hamburger state-${state}` }>
			<div className='icon' />
		</div>
	);
}
