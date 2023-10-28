import classNames from 'classnames';
import React, { ReactElement, useEffect, useReducer, useState } from 'react';
import { EXTRA_ASSETS_ADDRESS, GAME_NAME, GAME_VERSION } from '../../config/Environment';
import './loginTeaser.scss';
import { Column, Row } from '../common/container/container';

const TEASER_CONTENTS: [string, string][] = [
	[`Welcome to ${ GAME_NAME } (version ${ GAME_VERSION })`, 'preview_1.png'],
	[`${ GAME_NAME } is an adult roleplaying community centered around the practice of BDSM.`, 'preview_2.png'],
	['We aim to provide a safe and welcoming environment for like-minded individuals to explore their kinks.', 'preview_3.png'],
	[`${ GAME_NAME } is a free open-source licensed platform. Feel invited to help building it up further.`, 'preview_4.png'],
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
		}, 8000);

		return () => {
			clearInterval(interval);
		};
	}, [autoTransitions]);

	return (
		<div className='LoginTeaser'>
			<Column className='teaser-content-box' alignX='center' alignY='center'>
				<Column className='teaser-content' gap='none' alignX='center'>
					<div className='teaser-text'>{ TEASER_CONTENTS[index][0] }</div>
					<Row alignX='center' alignY='center' className='teaser-image'>
						{
							EXTRA_ASSETS_ADDRESS ? (
								<img className='teaser-image' alt='Pandora teaser image' src={ EXTRA_ASSETS_ADDRESS + TEASER_CONTENTS[index][1] } />
							) : (
								<span className='padding-xx-large'>[ Pandora teaser image ]</span>
							)
						}
					</Row>
				</Column>
			</Column>
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
