import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * This is a service that listens for location changes, mainly anchor id changes.
 * It then triggers smooth autoscroll to the target element.
 *
 * The need for this comes from the fact, that react-router doesn't trigger actual navigation,
 * but only adds a history entry, so we need to do said behaviour ourselves.
 *
 * Note, that this still doesn't resolve the problem of slow-loading lazy components,
 * but navigating to them the second time should work.
 */
export function AnchorAutoscroll(): null {
	const { hash } = useLocation();

	useEffect(() => {
		const targetId = hash.replace(/^#/, '');

		if (!targetId)
			return;

		let cancel = false;

		// HACK: Do a short wait to increase the chance of things loading correctly
		setTimeout(() => {
			if (cancel)
				return;

			const target = document.getElementById(targetId);
			if (target != null) {
				target.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});
			}
		}, 100);

		// Cleanup the animation
		return () => {
			cancel = true;
		};
	}, [hash]);

	return null;
}
