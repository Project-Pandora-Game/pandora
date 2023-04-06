import classNames from 'classnames';
import React, { ReactElement, useEffect, useReducer, useState } from 'react';
import pandoraEntranceImage from '../../assets/pandora_entrance.png';
import { GAME_NAME, GAME_VERSION } from '../../config/Environment';
import './loginTeaser.scss';

const TEASER_CONTENTS: [string, string][] = [
	[`Welcome to ${ GAME_NAME } (version ${ GAME_VERSION })`, pandoraEntranceImage],
	[`${ GAME_NAME } is an adult roleplaying community centered around the practice of BDSM.`, pandoraEntranceImage],
	['We aim to provide a safe and welcoming environment for like-minded individuals to explore their kinks.', pandoraEntranceImage],
];

export function LoginTeaser(): ReactElement {
	const [autoTransitions, setAutoTransitions] = useState(true);

	const [index, setIndex] = useReducer((oldState: number, action: 'next' | number) => {
		if (action === 'next') {
			return (oldState + 1) % TEASER_CONTENTS.length;
		}
		setAutoTransitions(false);
		return action;
	}, 0);

	useEffect(() => {
		if (!autoTransitions)
			return;

		const interval = setInterval(() => {
			setIndex('next');
		}, 5000);

		return () => {
			clearInterval(interval);
		};
	}, [autoTransitions]);

	return (
		<div className='LoginTeaser'>
			<div className='teaser-text'>{ TEASER_CONTENTS[index][0] }</div>
			<img className='teaser-image' alt='Pandora teaser image' src={ TEASER_CONTENTS[index][1] } />
			<div className='teaser-navigation'>
				{ TEASER_CONTENTS.map((_, i) => (
					<div key={ i }
						className={ classNames('dot', { active: i === index }) }
						onClick={ () => setIndex(i) }
					/>
				)) }
			</div>
		</div>
	);
}
