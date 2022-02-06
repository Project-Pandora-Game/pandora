/** Checks if the `obj` is an object (not null, not array) */
export function IsObject(obj: unknown): obj is Record<string, unknown> {
	return !!obj && typeof obj === 'object' && !Array.isArray(obj);
}

export interface IStringValidationOptions {
	regex?: RegExp;
	minLength?: number;
	maxLength?: number;
}

/** Checks if the `str` is a string and validates it to the given parameters */
export function CreateStringValidator({ regex, minLength, maxLength }: IStringValidationOptions = {}): (str: unknown) => str is string {
	return (str: unknown): str is string => {
		if (typeof str !== 'string') {
			return false;
		}
		if (maxLength !== undefined && str.length > maxLength) {
			return false;
		}
		if (minLength !== undefined && str.length < minLength) {
			return false;
		}
		if (regex !== undefined && !regex.test(str)) {
			return false;
		}
		return true;
	};
}

export const IsString = CreateStringValidator();

/**
 * Tests if the parameter is a valid username
 *
 * TODO - finalize this to what we want
 */
export const IsUsername = CreateStringValidator({
	regex: /^[a-zA-Z0-9_-]+$/,
	minLength: 3,
	maxLength: 32,
});

/**
 * Tests if the parameter is a valid email address
 *
 * TODO - finalize this to what we want
 *
 * @see https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression/201378#201378
 */
export const IsEmail = CreateStringValidator({
	// eslint-disable-next-line no-control-regex
	regex: /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/,
	minLength: 5,
	maxLength: 256,
});

/**
 * Tests if string is a 'simple' token format - 6 digits
 */
export const IsSimpleToken = CreateStringValidator({
	regex: /^[0-9]*$/,
	minLength: 6,
	maxLength: 6,
});
