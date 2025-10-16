import { SpaceRoleOrNoneSchema, SpaceRoleSchema, type SpaceRole, type SpaceRoleOrNone } from 'pandora-common';
import type { ReactElement } from 'react';
import { SelectSettingInput, type SelectSettingInputProps } from '../../../components/settings/helpers/settingsInputs.tsx';

export const SPACE_ROLE_TEXT: Readonly<Record<SpaceRoleOrNone, string>> = {
	none: 'None',
	owner: 'Owner',
	admin: 'Admin',
	allowlisted: 'Allowlisted account',
	everyone: 'Visitor (no role)',
};

export const SPACE_ROLE_TEXT_CUMULATIVE: Readonly<Record<SpaceRoleOrNone, string>> = {
	none: 'No one',
	owner: 'Owners',
	admin: 'Owners and Admins',
	allowlisted: 'Owners, Admins, and Allowlisted accounts',
	everyone: 'Everyone',
};

export function SpaceRoleSelectInput({ cumulative = false, ...props }: {
	/** Whether to display options as cumulative (true) or stand-alone (false) selections */
	cumulative?: boolean;
} & Omit<SelectSettingInputProps<SpaceRole>, 'schema' | 'stringify' | 'optionOrder'>): ReactElement {
	return (
		<SelectSettingInput<SpaceRole>
			{ ...props }
			schema={ SpaceRoleSchema }
			stringify={ cumulative ? SPACE_ROLE_TEXT_CUMULATIVE : SPACE_ROLE_TEXT }
			optionOrder={ undefined }
		/>
	);
}

export function SpaceRoleOrNoneSelectInput({ cumulative = false, ...props }: {
	/** Whether to display options as cumulative (true) or stand-alone (false) selections */
	cumulative?: boolean;
} & Omit<SelectSettingInputProps<SpaceRoleOrNone>, 'schema' | 'stringify' | 'optionOrder'>): ReactElement {
	return (
		<SelectSettingInput<SpaceRoleOrNone>
			{ ...props }
			schema={ SpaceRoleOrNoneSchema }
			stringify={ cumulative ? SPACE_ROLE_TEXT_CUMULATIVE : SPACE_ROLE_TEXT }
			optionOrder={ undefined }
		/>
	);
}
