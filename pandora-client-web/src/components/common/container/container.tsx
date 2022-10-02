import classNames from 'classnames';
import React from 'react';
import { ReactElement } from 'react';
import { CommonProps } from '../../../common/reactTypes';
import { ScssSpacing } from '../../../styles/constants';
import './container.scss';

export interface DivContainerProps extends CommonProps {
	// Flex properties

	/** Default: row */
	direction?: 'column' | 'row';
	/** Default: false */
	wrap?: boolean | 'reverse';
	/** Default: false */
	reverse?: boolean;
	/** Default: start */
	justify?: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
	/** Default: stretch */
	align?: 'stretch' | 'start' | 'end' | 'center';
	/** Default: start */
	wrapAlign?: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';

	// Our spacing setup
	/** Default: normal */
	spacing?: ScssSpacing;
	/** Defaults to `spacing` */
	padding?: ScssSpacing;
	/** Defaults to `spacing` */
	gap?: ScssSpacing;
}

export function DivContainer({
	children,
	id,
	className,
	direction,
	wrap,
	reverse,
	justify,
	align,
	wrapAlign,
	spacing = 'normal',
	padding,
	gap,
}: DivContainerProps): ReactElement {
	return (
		<div
			id={ id }
			className={ classNames(
				'div-container',
				direction ? `direction-${direction}` : null,
				wrap === 'reverse' ? 'wrap-reverse' : wrap ? 'wrap' : null,
				reverse ? 'reverse' : null,
				justify ? `justify-${justify}` : null,
				align ? `align-${align}` : null,
				wrapAlign ? `wrap-align-${wrapAlign}` : null,
				`spacing-${spacing}`,
				padding ? `padding-${padding}` : null,
				gap ? `gap-${gap}` : null,
				className,
			) }
		>
			{ children }
		</div>
	)
}

export function Row({
	alignX,
	alignY,
	...props
}: Omit<DivContainerProps, 'direction' | 'justify' | 'align'> & {
	/** Default: start */
	alignX?: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
	/** Default: stretch */
	alignY?: 'stretch' | 'start' | 'end' | 'center';
}): ReactElement {
	return (
		<DivContainer { ... {
			...props,
			direction: 'row',
			justify: alignX,
			align: alignY,
		} }/>
	);
}

export function Column({
	alignX,
	alignY,
	...props
}: Omit<DivContainerProps, 'direction' | 'justify' | 'align'> & {
	/** Default: start */
	alignY?: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
	/** Default: stretch */
	alignX?: 'stretch' | 'start' | 'end' | 'center';
}): ReactElement {
	return (
		<DivContainer { ... {
			...props,
			direction: 'column',
			justify: alignY,
			align: alignX,
		} } />
	);
}
