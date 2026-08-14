import { useCallback, type ComponentPropsWithRef, type ReactElement } from 'react';
import type { CommonProps } from '../../../common/reactTypes.ts';

export interface InteractiveLinkProps extends CommonProps, Pick<ComponentPropsWithRef<'a'>, 'ref' | 'title'> {
	onClick: () => void;
}

/**
 * A link (`<a>`) element that does not perform navigation, but triggers a code callback instead.
 * Supports both mouse and keyboard triggers.
 */
export function InteractiveLink({ onClick, children, ref, ...props }: InteractiveLinkProps): ReactElement {
	return (
		<a
			{ ...props }
			ref={ ref }

			role='button'
			tabIndex={ 0 }

			onClick={ useCallback((ev) => {
				ev.preventDefault();
				onClick();
			}, [onClick]) }
			onKeyDown={ useCallback((ev) => {
				if (ev.key === 'Enter') {
					ev.preventDefault();
					onClick();
				} else if (ev.key === ' ') {
					ev.preventDefault();
					// Spacebar should activate on key up
				}

			}, [onClick]) }
			onKeyUp={ useCallback((ev) => {
				if (ev.key === ' ') {
					ev.preventDefault();
					onClick();
				}
			}, [onClick]) }
		>
			{ children }
		</a>
	);
}
