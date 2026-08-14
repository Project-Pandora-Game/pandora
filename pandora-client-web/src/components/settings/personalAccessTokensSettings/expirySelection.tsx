import { Assert, TimeSpanMs } from 'pandora-common';
import { useId, type ReactElement } from 'react';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Column } from '../../common/container/container.tsx';

const EXPIRY_PRESETS = {
	week: ['7 days', TimeSpanMs(7, 'days')],
	days30: ['30 days', TimeSpanMs(30, 'days')],
	days60: ['60 days', TimeSpanMs(60, 'days')],
	days90: ['90 days', TimeSpanMs(90, 'days')],
	year: ['1 year', TimeSpanMs(365, 'days')],
	never: ['Does not expire', null],
} as const satisfies Record<string, readonly [string, number | null]>;

export type PATExpiryPreset = keyof typeof EXPIRY_PRESETS;

export const PAT_EXPIRY_DEFAULT: PATExpiryPreset = 'days30';

export function PATExpiryPresetToTime(preset: PATExpiryPreset): number | null {
	const expiry = EXPIRY_PRESETS[preset][1];
	return expiry != null ? Date.now() + expiry : null;
}

export function PATExpirySelection({ expires, onChange }: {
	expires: PATExpiryPreset;
	onChange: ((newExpires: PATExpiryPreset) => void) | null;
}): ReactElement {
	const id = useId();
	const now = Date.now();

	return (
		<Column gap='small'>
			<label htmlFor={ id }>Expiration</label>
			<Select
				id={ id }
				value={ expires }
				onChange={ (ev) => {
					const newValue = ev.currentTarget.value as PATExpiryPreset;
					Assert(Object.hasOwn(EXPIRY_PRESETS, newValue), 'Invalid expiry preset');
					onChange?.(newValue);
				} }
				disabled={ onChange == null }
			>
				{ Object.entries(EXPIRY_PRESETS).map(([preset, [text, expiry]]) => (
					<option key={ preset } value={ preset }>
						{ text + (expiry != null ? ` (${new Date(now + expiry).toLocaleDateString()})` : '') }
					</option>
				)) }
			</Select>
		</Column>
	);
}
