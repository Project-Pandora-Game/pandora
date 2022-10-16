import classNames from 'classnames';
import React, { HTMLAttributes, DetailedHTMLProps, ReactElement } from 'react';
import './scrollbar.scss';

export type ScrollbarColor = 'dark' | 'lighter';

export interface ButtonProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
	color: ScrollbarColor;
}

export function Scrollbar({ color, children, className, ...divProps }: ButtonProps): ReactElement {
	return (
		<div { ...divProps } className={ classNames('Scrollbar', className, color) }>
			{ children }
		</div>
	);
}
