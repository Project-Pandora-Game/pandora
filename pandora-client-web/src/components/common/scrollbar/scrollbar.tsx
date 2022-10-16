import classNames from 'classnames';
import React, { HTMLAttributes, DetailedHTMLProps, ReactElement, ForwardedRef, forwardRef } from 'react';
import './scrollbar.scss';

export type ScrollbarColor = 'dark' | 'lighter';

export interface ButtonProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
	color: ScrollbarColor;
}

function ScrollbarImpl({ color, children, className, ...divProps }: ButtonProps, ref: ForwardedRef<HTMLDivElement>): ReactElement {
	return (
		<div { ...divProps } ref={ ref } className={ classNames('Scrollbar', className, color) }>
			{ children }
		</div>
	);
}

export const Scrollbar = forwardRef(ScrollbarImpl);
