import React, { ReactElement } from 'react';
import { GAME_NAME, GAME_VERSION } from '../../config/Environment';

export function Pandora(): ReactElement {
	return (
		<div className="Pandora">
			<h1>Welcome to { GAME_NAME }</h1>
			<span>Game version: { GAME_VERSION }</span>
		</div>
	);
}
