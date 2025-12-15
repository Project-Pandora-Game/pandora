import classNames from 'classnames';
import { ReactElement, type DetailedHTMLProps, type HTMLAttributes } from 'react';
import type { CommonProps } from '../../../common/reactTypes.ts';
import type { ScssOverflow, ScssSpacing } from '../../../styles/constants.ts';
import './container.scss';

export interface DivContainerProps extends CommonProps, Pick<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, 'style' | 'inert'> {
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

	// Overflow properties
	/** Default: visible */
	overflowX?: ScssOverflow;
	/** Default: visible */
	overflowY?: ScssOverflow;

	// Our spacing setup
	/** Defaults to `none` */
	padding?: Exclude<ScssSpacing, 'none'>;
	/** Defaults to `medium` */
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
	overflowX,
	overflowY,
	padding,
	gap = 'medium',
	...props
}: DivContainerProps): ReactElement {
	return (
		<div
			{ ...props }
			id={ id }
			className={ classNames(
				'div-container',
				direction ? `direction-${direction}` : null,
				wrap === 'reverse' ? 'wrap-reverse' : wrap ? 'wrap' : null,
				reverse ? 'reverse' : null,
				justify ? `justify-${justify}` : null,
				align ? `align-${align}` : null,
				wrapAlign ? `wrap-align-${wrapAlign}` : null,
				overflowX ? `overflow-x-${overflowX}` : null,
				overflowY ? `overflow-y-${overflowY}` : null,
				padding ? `padding-${padding}` : null,
				`gap-${gap}`,
				className,
			) }
		>
			{ children }
		</div>
	);
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
		} } />
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
