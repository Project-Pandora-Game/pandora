import {
	MakePermissionConfigFromDefault,
	PermissionType,
	type PermissionGroup,
} from 'pandora-common';
import { useMemo, useState, type ReactElement } from 'react';
import forbid from '../../../assets/icons/forbidden.svg';
import promptIcon from '../../../assets/icons/prompt.svg';
import allow from '../../../assets/icons/public.svg';
import { HoverElement } from '../../../components/hoverElement/hoverElement.tsx';
import { usePermissionGetConfig } from '../../../services/gameLogic/permissionSettingsDriver.ts';

export function PermissionAllowOthersIcon({ config }: { config: PermissionType; }): ReactElement {
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const { src, alt, description } = useMemo(() => {
		switch (config) {
			case 'yes':
				return {
					src: allow,
					alt: 'General permission configuration preview',
					description: 'Everyone is allowed to do this, but exceptions can be set individually.',
				};
			case 'no':
				return {
					src: forbid,
					alt: 'General permission configuration preview',
					description: 'No one is allowed to do this, but exceptions can be set individually.',
				};
			case 'prompt':
				return {
					src: promptIcon,
					alt: 'General permission configuration preview',
					description: 'Trying to use this permission opens a popup that lets the targeted user decide if they want to give or deny the requester this permission. Exceptions can be set individually.',
				};
		}
	}, [config]);

	return (
		<>
			<img ref={ setRef } src={ src } width='26' height='26' alt={ alt } />
			<HoverElement parent={ ref } className='attribute-description'>
				{ description }
			</HoverElement>
		</>
	);
}

function useEffectiveAllowOthers(permissionGroup: PermissionGroup, permissionId: string): PermissionType {
	const permissionData = usePermissionGetConfig(permissionGroup, permissionId);
	if (permissionData?.result !== 'ok')
		return 'no';

	const {
		permissionSetup,
		permissionConfig,
	} = permissionData;

	if (permissionConfig != null)
		return permissionConfig.allowOthers;

	return MakePermissionConfigFromDefault(permissionSetup.defaultConfig).allowOthers;
}

export function PermissionEffectiveAllowOthersIcon({ permissionGroup, permissionId }: { permissionGroup: PermissionGroup; permissionId: string; }): ReactElement {
	const effectiveConfig = useEffectiveAllowOthers(permissionGroup, permissionId);
	return (
		<PermissionAllowOthersIcon config={ effectiveConfig } />
	);
}
