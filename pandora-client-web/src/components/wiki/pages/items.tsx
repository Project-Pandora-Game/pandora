import React, { ReactElement } from 'react';

export function WikiItems(): ReactElement {
	return (
		<>
			<h2>Characters</h2>

			<h3>How do characters in Pandora work?</h3>

			<p>
				Text block 1<br />
				Text block 2
			</p>

			<h3>What are all character-specific features?</h3>

			<h4>Feature name</h4>
			<p>
				Text block 1<br />
				Text block 2
			</p>
			<ul>
				<li>Subfeature 1</li>
				<li>Subfeature 2</li>
				<li>Subfeature 3</li>
			</ul>

		</>
	);
}
