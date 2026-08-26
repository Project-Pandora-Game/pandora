import { KnownObject } from 'pandora-common';
import { PANDORA_BOT_SPACE_PERMISSIONS, type PandoraBotSpacePermissionList } from 'pandora-common/bots';
import { Fragment, useId, type ReactElement } from 'react';
import { Checkbox } from '../../../../common/userInteraction/checkbox.tsx';
import { Column, Row } from '../../../../components/common/container/container.tsx';
import { GridContainer } from '../../../../components/common/container/gridContainer.tsx';

export function BotSpacePermissions({ selectedPermissions, filterPermissions, onChange }: {
	selectedPermissions: PandoraBotSpacePermissionList;
	/** If set, only these permissions will be offered and passed to `onChange`. Useful to limit selectable permissions. */
	filterPermissions?: PandoraBotSpacePermissionList;
	onChange: ((newPermissions: PandoraBotSpacePermissionList) => void) | null;
}): ReactElement {
	const id = useId();

	return (
		<Column gap='small'>
			<strong>Bot's Space Permissions</strong>
			<GridContainer templateColumns='minmax(max-content, 1fr) 2fr' templateRows='auto-flow' gap='small' alignItemsY='start'>
				{ KnownObject.entries(PANDORA_BOT_SPACE_PERMISSIONS)
					.filter(([permission]) => filterPermissions == null || filterPermissions.includes(permission))
					.map(([permission, { name, description }]) => {
						return (
							<Fragment key={ permission }>
								{ onChange != null ? (
									<Row alignY='center'>
										<Checkbox
											id={ id + ':' + permission }
											checked={ selectedPermissions.includes(permission) }
											onChange={ (checked) => {
												if (checked && !selectedPermissions.includes(permission)) {
													onChange([...selectedPermissions, permission]
														.filter((it) => filterPermissions == null || filterPermissions.includes(it)));
												} else {
													onChange(selectedPermissions
														.filter((it) => it !== permission)
														.filter((it) => filterPermissions == null || filterPermissions.includes(it)));
												}
											} }
										/>
										<label htmlFor={ id + ':' + permission }>{ name }</label>
									</Row>
								) : (
									<span>{ name }</span>
								) }
								<div>
									{ description }
								</div>
							</Fragment>
						);
					}) }
			</GridContainer>
		</Column>
	);
}
