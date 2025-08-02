import type { AssetFrameworkGlobalState } from 'pandora-common';
import { useMemo, type ReactElement } from 'react';
import type { IChatroomCharacter } from '../../../character/character.ts';
import { Column } from '../../common/container/container.tsx';
import { useWardrobeActionContext } from '../wardrobeActionContext.tsx';

export function WardrobeCurrentEffectsView({ character, globalState }: {
	character: IChatroomCharacter;
	globalState: AssetFrameworkGlobalState;
}): ReactElement {
	const { actions } = useWardrobeActionContext();

	const restrictionManager = character.getRestrictionManager(globalState, actions.spaceContext);
	const effects = restrictionManager.getEffects();

	const effectsList = useMemo((): ReactElement[] => {
		const result: ReactElement[] = [];

		if (effects.blockHands) {
			result.push(<li key='blockHands'>Cannot use hands</li>);
		}
		if (effects.blockRoomMovement) {
			result.push(<li key='blockRoomMovement'>Cannot move within the room</li>);
		}
		if (effects.blockSpaceLeave) {
			result.push(<li key='blockSpaceLeave'>Cannot leave the current space</li>);
		}
		if (effects.blind > 0) {
			result.push(<li key='blind'>{ effects.blind >= 10 ? 'Fully blinded' : `${10 * effects.blind}% blinded` }</li>);
		}
		if (effects.blurVision > 0) {
			result.push(<li key='blurVision'>Blurry vision ({ effects.blurVision })</li>);
		}
		if (
			effects.lipsTouch > 0 ||
			effects.jawMove > 0 ||
			effects.tongueRoof > 0 ||
			effects.mouthBreath > 0 ||
			effects.throatBreath > 0 ||
			effects.coherency > 0 ||
			effects.stimulus > 0
		) {
			result.push(<li key='MuffleSettings'>Limited speech</li>);
		}
		if (
			effects.distortion > 0 ||
			effects.frequencyLoss > 0 ||
			effects.vowelLoss > 0 ||
			effects.middleLoss > 0
		) {
			result.push(<li key='HearingImpairmentSettings'>Limited hearing</li>);
		}

		return result;
	}, [effects]);

	return (
		<Column className='flex-1' padding='medium'>
			<h1>Effects applied to { character.name } ({ character.id })</h1>
			{
				effectsList.length > 0 ? (
					<ul>
						{ effectsList }
					</ul>
				) : (
					<i>None</i>
				)
			}
		</Column>
	);
}
