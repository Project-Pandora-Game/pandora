import type { ReactElement } from 'react';
import { Link } from 'react-router';
import wikiIcon from '../../../assets/icons/wiki.svg';
import './wikiButton.scss';

export interface WikiButtonProps {
	link: string;
}

export function WikiButton({ link }: WikiButtonProps): ReactElement {
	return (
		<Link title='Get help in the wiki' to={ link } className='WikiButton flex-row'>
			<img src={ wikiIcon } width='26' height='26' alt='Wiki' />
		</Link>
	);
}
