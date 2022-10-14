import classNames from 'classnames';
import React, { HTMLAttributes, DetailedHTMLProps, ReactElement } from 'react';
import './slimScrollbar.scss';

export type ScrollbarColor = 'dark' | 'lighter';

export interface ButtonProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
	color: ScrollbarColor;
}

export function SlimScrollbar({ color, children, className, ...divProps }: ButtonProps): ReactElement {
	return (
		<div { ...divProps } className={ classNames('SlimScrollbar', className, color) }>
			{ children }
		</div>
	);
}
