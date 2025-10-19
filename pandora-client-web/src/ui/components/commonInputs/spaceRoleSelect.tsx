import { SpaceRoleOrNoneSchema, SpaceRoleSchema, type SpaceRole, type SpaceRoleOrNone } from 'pandora-common';
import type { ReactElement } from 'react';
import { SelectSettingInput, type SelectSettingInputProps } from '../../../components/settings/helpers/settingsInputs.tsx';

const SPACE_ROLE_NO_NONE_TEXT: Readonly<Record<SpaceRole, string>> = {
	owner: 'Owner',
	admin: 'Admin',
	allowlisted: 'Allowlisted account',
	everyone: 'Visitor (no role)',
};

export const SPACE_ROLE_TEXT: Readonly<Record<SpaceRoleOrNone, string>> = {
	none: 'None',
	...SPACE_ROLE_NO_NONE_TEXT,
};

const SPACE_ROLE_NO_NONE_TEXT_CUMULATIVE: Readonly<Record<SpaceRole, string>> = {
	owner: 'Owners',
	admin: 'Owners and Admins',
	allowlisted: 'Owners, Admins, and Allowlisted accounts',
	everyone: 'Everyone',
};

export const SPACE_ROLE_TEXT_CUMULATIVE: Readonly<Record<SpaceRoleOrNone, string>> = {
	none: 'No one',
	...SPACE_ROLE_NO_NONE_TEXT_CUMULATIVE,
};

export function SpaceRoleSelectInput({ cumulative = false, ...props }: {
	/** Whether to display options as cumulative (true) or stand-alone (false) selections */
	cumulative?: boolean;
} & Omit<SelectSettingInputProps<SpaceRole>, 'schema' | 'stringify' | 'optionOrder'>): ReactElement {
	return (
		<SelectSettingInput<SpaceRole>
			{ ...props }
			schema={ SpaceRoleSchema }
			stringify={ cumulative ? SPACE_ROLE_NO_NONE_TEXT_CUMULATIVE : SPACE_ROLE_NO_NONE_TEXT }
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
