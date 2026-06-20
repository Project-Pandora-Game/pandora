import { type AssetPreferenceType, AssertNever } from 'pandora-common';
import type { ReactElement } from 'react';

export function WardrobeItemPreferenceIcon({ preference }: { preference: AssetPreferenceType | null; }): ReactElement | null {
	if (preference == null || preference === 'normal')
		return null;

	return (
		<div className={ `ItemPreferenceIcon pref-${preference}` }>
			{ preference === 'favorite' ? '★' :
				preference === 'maybe' ? '?' :
					preference === 'prevent' ? '✕' :
						preference === 'doNotRender' ? '✕' :
							AssertNever(preference) }
		</div>
	);
}
