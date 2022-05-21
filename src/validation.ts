/** Checks if the `obj` is an object (not null, not array) */
export function IsObject(obj: unknown): obj is Record<string, unknown> {
	return !!obj && typeof obj === 'object' && !Array.isArray(obj);
}

export interface IStringValidationOptions {
	regex?: RegExp;
	minLength?: number;
	maxLength?: number;
	trimCheck?: true;
}

export interface IArrayValidationOptions<T = unknown> {
	validator?: (value: T, index: number) => boolean;
	minLength?: number;
	maxLength?: number;
}

/** Checks if the `str` is a string and validates it to the given parameters */
export function CreateStringValidator<T extends string = string>({ regex, minLength, maxLength, trimCheck }: IStringValidationOptions = {}): (str: unknown) => str is T {
	return (str: unknown): str is T => {
		if (typeof str !== 'string') {
			return false;
		}
		if (maxLength !== undefined && str.length > maxLength) {
			return false;
		}
		if (minLength !== undefined && str.length < minLength) {
			return false;
		}
		if (trimCheck && str.trim() !== str) {
			return false;
		}
		if (regex !== undefined && !regex.test(str)) {
			return false;
		}
		return true;
	};
}

export const CreateBase64Validator = (args: Omit<IStringValidationOptions, 'regex'> = {}) => CreateStringValidator({
	...args,
	regex: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
});

export function CreateArrayValidator<T = unknown>({ validator, minLength, maxLength }: IArrayValidationOptions<T> = {}): (arr: unknown) => arr is T[] {
	return (arr: unknown): arr is T[] => {
		if (!Array.isArray(arr))
			return false;
		if (maxLength !== undefined && arr.length > maxLength)
			return false;
		if (minLength !== undefined && arr.length < minLength)
			return false;
		if (validator !== undefined && !arr.every(validator))
			return false;

		return true;
	};
}

export type ObjectValidatorConfig<T extends Record<string, unknown>> = { [K in keyof T]: (value: unknown) => value is T[K] };

export function CreateObjectValidator<T extends Partial<Record<keyof T, unknown>>>(validatorObject: ObjectValidatorConfig<T>, args?: {
	noExtraKey?: boolean;
	partial?: false;
}): (obj: unknown) => obj is T;
export function CreateObjectValidator<T extends Partial<Record<keyof T, unknown>>>(validatorObject: ObjectValidatorConfig<T>, args: {
	noExtraKey?: boolean;
	partial: true;
}): (obj: unknown) => obj is Partial<T>;
export function CreateObjectValidator<T extends Partial<Record<keyof T, unknown>>>(validatorObject: ObjectValidatorConfig<T>, {
	noExtraKey = false,
	partial = false,
}: {
	noExtraKey?: boolean;
	partial?: boolean;
} = {}): (obj: unknown) => obj is T {
	return (obj: unknown): obj is T => {
		if (!IsObject(obj))
			return false;

		if (noExtraKey) {
			const requiredKeys = Object.keys(validatorObject);
			const keys = new Set(Object.keys(obj));

			for (const key of requiredKeys) {
				if (partial && obj[key] === undefined)
					continue;
				if (!validatorObject[key as keyof T](obj[key]))
					return false;
				if (!keys.delete(key) && obj[key] !== undefined)
					return false;
			}

			if (keys.size !== 0)
				return false;
		} else {
			for (const key in validatorObject) {
				if (partial && obj[key] === undefined)
					continue;
				if (!validatorObject[key](obj[key]))
					return false;
			}
		}

		return true;
	};
}

export function CreateMaybeValidator<T>(validator: (value: unknown) => value is T): (value: unknown) => value is (T | undefined) {
	if (typeof validator !== 'function') {
		throw new Error('Expected validator function');
	}
	return (value: unknown): value is (T | undefined) => IsUndefined(value) || validator(value);
}

export type Nullable<T> = T | null;
export type NonNullable<T> = Exclude<T, null>;
export function CreateNullableValidator<T>(validator: (value: unknown) => value is T): (value: unknown) => value is Nullable<T> {
	if (typeof validator !== 'function') {
		throw new Error('Expected validator function');
	}
	return (value: unknown): value is Nullable<T> => value === null || validator(value);
}

export function CreateOneOfValidator<T extends string | number>(...accepted: T[]): (value: unknown) => value is T {
	return (value: unknown): value is T => accepted.includes(value as T);
}

export const IsString = CreateStringValidator();

export const IsNumber = (value: unknown): value is number => typeof value === 'number';

export const IsBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const IsUndefined = (value: unknown): value is undefined => value === undefined;

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
 * Tests if the parameter is a valid character name
 *
 * TODO - finalize this to what we want
 */
export const IsCharacterName = CreateStringValidator({
	regex: /^[a-zA-Z0-9_\- ]+$/,
	minLength: 3,
	maxLength: 32,
	trimCheck: true,
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
