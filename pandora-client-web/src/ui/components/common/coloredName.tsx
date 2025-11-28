import classNames from 'classnames';
import { type HexColorString } from 'pandora-common';
import { memo, type ReactElement } from 'react';
import './coloredName.scss';

export interface ColoredNameProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> {
	color: HexColorString;
}

export const ColoredName = memo(function ColoredName({ color, className, style, ...props }: ColoredNameProps): ReactElement {
	return (
		<span
			{ ...props }
			className={ classNames(
				'ColoredName',
				className,
			) }
			style={ {
				...style,
				color,
			} }
		>

		</span>
	);
});
