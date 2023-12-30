import React, { ReactElement } from 'react';

export function WikiSafety(): ReactElement {
	return (
		<>
			<h2>User safety</h2>

			<h3>Introduction</h3>

			<p>
				Text block 1<br />
				Text block 2
			</p>

			<h3>Safety-specific features</h3>
			<ul>
				{
					// <li><a href='#SA_'></a></li>
				}
			</ul>

			<h4 id='SA_'>Feature name</h4>
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
