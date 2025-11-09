import classNames from 'classnames';
import { ReactElement, type DetailedHTMLProps, type HTMLAttributes } from 'react';
import { CommonProps } from '../../../common/reactTypes.ts';
import { ScssSpacing } from '../../../styles/constants.ts';
import './gridContainer.scss';

export interface GridContainerProps extends CommonProps, Pick<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, 'style' | 'inert'> {
	// Grid properties

	/** Use `inline-grid` rather than `grid`, Default: `false` */
	inline?: boolean;

	/**
	 * Rows part of the grid template. Can be in the following forms:
	 * - `<row> <row> …`
	 * - `auto-flow [row]`
	 * @default 'auto'
	 */
	templateRows?: string | 'auto-flow' | `auto-flow ${string}`;
	/**
	 * Columns part of the grid template. Can be in the following forms:
	 * - `<column> <column> …`
	 * - `auto-flow [column]`
	 * @default 'auto'
	 */
	templateColumns?: string | 'auto-flow' | `auto-flow ${string}`;
	/** Default: `stretch` */
	alignItemsX?: 'stretch' | 'start' | 'end' | 'center';
	/** Default: `stretch` */
	alignItemsY?: 'stretch' | 'start' | 'end' | 'center' | 'baseline';
	/** Default: `start` */
	alignColumns?: 'start' | 'end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly';
	/** Default: `start` */
	alignRows?: 'start' | 'end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly';

	// Our spacing setup
	/** Defaults to `none` */
	padding?: Exclude<ScssSpacing, 'none'>;
	/** Defaults to `medium` */
	gap?: ScssSpacing;
}

export function GridContainer({
	children,
	id,
	className,
	inline = false,
	templateRows = 'auto',
	templateColumns = 'auto',
	alignItemsX,
	alignItemsY,
	alignColumns,
	alignRows,
	padding,
	gap = 'medium',
	style,
	...props
}: GridContainerProps): ReactElement {
	return (
		<div
			{ ...props }
			id={ id }
			className={ classNames(
				'GridContainer',
				inline ? 'inline' : null,
				alignItemsX ? `justify-items-${alignItemsX}` : null,
				alignItemsY ? `align-items-${alignItemsY}` : null,
				alignColumns ? `justify-${alignColumns}` : null,
				alignRows ? `align-${alignRows}` : null,
				padding ? `padding-${padding}` : null,
				`gap-${gap}`,
				className,
			) }
			style={ {
				...style,
				grid: `${templateRows} / ${ templateColumns }`,
			} }
		>
			{ children }
		</div>
	);
}
