import { type ReactElement } from 'react';
import { Select } from '../../../../../common/userInteraction/select/select';
import { Button } from '../../../../common/button/button';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition';
import { SpacePublicSettingSchema } from 'pandora-common';

export function ConditionInSpaceWithVisibility({ condition, setCondition, invert, setInvert, processing }: CharacterModifierConditionListEntryProps<'inSpaceWithVisibility'>): ReactElement {

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Not in' : 'In' }
			</Button>
			{ ' a space that has the visibility ' }
			<Select
				value={ condition.spaceVisibility }
				onChange={
					(e) => setCondition?.({
						type: 'inSpaceWithVisibility',
						spaceVisibility: SpacePublicSettingSchema.parse(e.target.value),
					})
				}
				noScrollChange
				disabled={ processing }
			>
				<option value='locked'>locked</option>
				<option value='private'>private</option>
				<option value='public-with-admin'>public with admin</option>
				<option value='public-with-anyone'>public</option>
			</Select>
		</span>
	);
}

