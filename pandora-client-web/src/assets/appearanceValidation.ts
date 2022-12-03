import { AppearanceActionResult, AssertNever } from 'pandora-common';
import { DescribeAsset } from '../components/gameContext/chatRoomContextProvider';
import { AssetManagerClient } from './assetManager';

export function RenderAppearanceActionResult(assetManager: AssetManagerClient, result: AppearanceActionResult): string {
	if (result.result === 'success') {
		return 'No problem.';
	} else if (result.result === 'invalidAction') {
		return `This action isn't possible.`;
	} else if (result.result === 'restrictionError') {
		return `Your character cannot do that right now.\n(details not available yet)`;
	} else if (result.result === 'validationError') {
		const e = result.validationError;
		switch (e.problem) {
			case 'bodypartError':
				switch (e.problemDetail) {
					case 'incorrectOrder':
						return `Bodyparts must be in a specific order.`;
					case 'multipleNotAllowed':
						return `Some bodyparts can only be equipped once.`;
					case 'missingRequired':
						return `Some bodyparts can only be replaced, not removed.`;
				}
				break;
			case 'unsatisfiedRequirement': {
				const negative = e.requirement.startsWith('!');
				const attributeName = negative ? e.requirement.substring(1) : e.requirement;
				const attribute = assetManager.getAttributeDefinition(attributeName);
				const description = attribute ? `"${attribute.description}"` : `[UNKNOWN ATTRIBUTE '${attributeName}']`;
				if (e.asset) {
					return `The ${DescribeAsset(assetManager, e.asset)} ${negative ? 'conflicts with' : 'requires'} ${description}`;
				} else {
					return `The item ${negative ? 'must not' : 'must'} be ${description}.`;
				}
			}
			case 'poseConflict':
				return `The combination of items requires conflicting pose.`;
			case 'tooManyItems':
				return e.asset ?
					`At most ${e.limit} "${DescribeAsset(assetManager, e.asset)}" can be equipped.` :
					`At most ${e.limit} items can be present.`;
			case 'contentNotAllowed':
				return `The ${DescribeAsset(assetManager, e.asset)} cannot be used in that way.`;
			case 'invalid':
				return `The action results in a generally invalid state.`;
		}
		AssertNever(e);
	}
	AssertNever(result.result);
}
