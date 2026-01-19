import { Immutable, produce } from 'immer';
import {
	type Asset,
	type ItemTemplate,
} from 'pandora-common';
import { ReactElement } from 'react';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';

export function WardrobeTemplatePersonalItemDeployment({ asset, template, updateTemplate }: {
	asset: Asset<'personal'>;
	template: Immutable<ItemTemplate>;
	updateTemplate: (newTemplate: Immutable<ItemTemplate>) => void;
}): ReactElement | null {

	if (asset.definition.roomDeployment == null)
		return null;

	const autoDeploy = template.personalData?.autoDeploy ?? true;

	return (
		<FieldsetToggle legend='Room visibility'>
			<Column padding='medium'>
				<i>This item can be displayed inside the room if moved to the room inventory</i>
				<Row alignX='space-between' alignY='center'>
					{ autoDeploy ? (
						<div>Item will be shown automatically</div>
					) : (
						<div>Item will <strong>not</strong> be shown automatically</div>
					) }
					<button
						className='wardrobeActionButton allowed'
						onClick={ (ev) => {
							ev.stopPropagation();
							updateTemplate(produce(template, (d) => {
								d.personalData ??= {};
								d.personalData.autoDeploy = !autoDeploy;
							}));
						} }
					>
						{ autoDeploy ? (
							'Disable'
						) : (
							'Enable'
						) }
					</button>
				</Row>
			</Column>
		</FieldsetToggle>
	);
}
