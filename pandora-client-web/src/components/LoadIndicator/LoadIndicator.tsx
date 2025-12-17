import type { ReactElement, ReactNode } from 'react';
import './LoadIndicator.scss';

let LoadIndicatorAnimationStart: CSSNumberish | null | undefined;

function SyncLoadIndicatorAnimationTime(ev: React.AnimationEvent<HTMLDivElement>) {
	const animation = ev.currentTarget.getAnimations().filter((a) => a instanceof CSSAnimation).find((a) => a.animationName === ev.animationName);
	if (ev.animationName === 'LoadIndicatorTurn' && animation != null) {
		if (LoadIndicatorAnimationStart == null) {
			LoadIndicatorAnimationStart = animation.startTime;
		} else {
			animation.startTime = LoadIndicatorAnimationStart;
		}
	}
}

export function LoadIndicator({
	children = 'Loading…',
}: {
	children?: ReactNode;
}): ReactElement {
	return (
		<div className='LoadIndicator' onAnimationStart={ SyncLoadIndicatorAnimationTime }>{ children }</div>
	);
}
