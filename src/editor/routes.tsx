import React, { ReactElement } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Editor } from './components/editor';

export function EditorRoutes(): ReactElement {
	return (
		<Routes>
			<Route path='*' element={ <Editor /> } />
		</Routes>
	);
}
