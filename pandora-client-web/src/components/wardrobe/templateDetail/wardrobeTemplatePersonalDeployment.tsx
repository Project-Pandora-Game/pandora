import { Immutable, produce } from 'immer';
import {
	type Asset,
	type ItemTemplate,
	type PersonalItemDeploymentAutoDeploy,
} from 'pandora-common';
import { ReactElement } from 'react';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import classNames from 'classnames';

export function WardrobeTemplatePersonalItemDeployment({ asset, template, updateTemplate }: {
	asset: Asset<'personal'>;
	template: Immutable<ItemTemplate>;
	updateTemplate: (newTemplate: Immutable<ItemTemplate>) => void;
}): ReactElement | null {

	if (asset.definition.roomDeployment == null)
		return null;

	const autoDeploy: PersonalItemDeploymentAutoDeploy = template.personalData?.autoDeploy ?? 'atCharacter';

	return (
		<FieldsetToggle legend='Room visibility'>
			<Column padding='medium'>
				<i>This item can be displayed inside the room if moved to the room inventory</i>
				<Column gap='tiny'>
					When this item is moved to a room inventory:
					<Row alignY='center' wrap gap='tiny'>
						<button
							className={ classNames('wardrobeActionButton allowed slim flex-grow-1', autoDeploy === false ? 'selected' : null) }
							onClick={ (ev) => {
								ev.stopPropagation();
								updateTemplate(produce(template, (d) => {
									d.personalData ??= {};
									d.personalData.autoDeploy = false;
								}));
							} }
						>
							Do not display
						</button>
						<button
							className={ classNames('wardrobeActionButton allowed slim flex-grow-1', autoDeploy === 'atCharacter' ? 'selected' : null) }
							onClick={ (ev) => {
								ev.stopPropagation();
								updateTemplate(produce(template, (d) => {
									d.personalData ??= {};
									d.personalData.autoDeploy = 'atCharacter';
								}));
							} }
						>
							Place near character
						</button>
						<button
							className={ classNames('wardrobeActionButton allowed slim flex-grow-1', autoDeploy === 'keepPosition' ? 'selected' : null) }
							onClick={ (ev) => {
								ev.stopPropagation();
								updateTemplate(produce(template, (d) => {
									d.personalData ??= {};
									d.personalData.autoDeploy = 'keepPosition';
								}));
							} }
						>
							Place at previous spot
						</button>
					</Row>
				</Column>
			</Column>
		</FieldsetToggle>
	);
}
