import {
	z,
	ZodFirstPartyTypeKind,
	ZodIssueCode,
	type ZodTypeAny,
} from 'zod';
import { IsObject, ZodTemplateString } from './validation';
import { GetLogger } from './logging';

declare const process: Record<string, Record<string, unknown>>;

const logger = GetLogger('ENV');

export function CreateEnvParser<TEnvSchema extends Record<string, ZodTypeAny> = NonNullable<unknown>>(envSchema: TEnvSchema) {
	const transformed: Record<string, ZodTypeAny> = {};
	for (const [key, schema] of Object.entries(envSchema)) {
		if (!EnvironmentKeySchema.safeParse(key).success) {
			logger.fatal();
			throw new Error('failed to create env');
		}
		switch (GetZodDefType(schema)) {
			case 'boolean':
				transformed[key] = z.preprocess((arg, ctx) => {
					if (arg == null) {
						return arg;
					}
					if (typeof arg !== 'string') {
						ctx.addIssue({
							code: ZodIssueCode.custom,
							message: 'must be a "true" or "false"',
						});
						return z.NEVER;
					}
					switch (arg.trim().toLowerCase()) {
						case 'true':
							return true;
						case 'false':
							return false;
						default:
							ctx.addIssue({
								code: ZodIssueCode.custom,
								message: 'must be a "true" or "false"',
							});
							return z.NEVER;
					}
				}, schema);
				break;
			case 'number':
				transformed[key] = z.preprocess((arg, ctx) => {
					if (arg == null) {
						return arg;
					}
					if (typeof arg !== 'string') {
						ctx.addIssue({
							code: ZodIssueCode.custom,
							message: 'must be a number',
						});
						return z.NEVER;
					}
					return parseInt(arg);
				}, schema);
				break;
			case 'unfiltered':
				transformed[key] = schema;
				break;
		}
	}
	return (obj?: Record<string, unknown>): EnvOutput<TEnvSchema> => {
		if (obj === undefined) {
			if (!('process' in globalThis) || !IsObject(process?.env)) {
				logger.fatal('process.env is not an object');
				throw new Error('failed to create env');
			}
			obj = process.env;
		}
		const parsed = z.object(transformed).safeParse(obj);
		if (!parsed.success) {
			logger.fatal(parsed.error.toString());
			throw new Error('failed to create env');
		}
		return parsed.data as unknown as EnvOutput<TEnvSchema>;
	};
}

function GetZodDefType(schema: ZodTypeAny): 'number' | 'boolean' | 'unfiltered' {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	switch (schema._def.typeName) {
		case ZodFirstPartyTypeKind.ZodNumber:
			return 'number';
		case ZodFirstPartyTypeKind.ZodBoolean:
			return 'boolean';
		case ZodFirstPartyTypeKind.ZodCatch:
		case ZodFirstPartyTypeKind.ZodDefault:
		case ZodFirstPartyTypeKind.ZodLazy:
		case ZodFirstPartyTypeKind.ZodNullable:
		case ZodFirstPartyTypeKind.ZodOptional:
		case ZodFirstPartyTypeKind.ZodReadonly:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
			return GetZodDefType(schema._def.innerType);
		case ZodFirstPartyTypeKind.ZodEffects:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
			return GetZodDefType(schema._def.schema);
		default:
			return 'unfiltered';
	}
}

const EnvironmentKeySchema = ZodTemplateString(z.string(), /^[A-Z0-9_]+$/);

export type EnvOutput<TEnvSchema extends Record<string, ZodTypeAny>> = {
	readonly [K in keyof TEnvSchema]: z.output<TEnvSchema[K]>;
};

export type EnvInputJson<TEnvSchema extends Record<string, ZodTypeAny>> = {
	readonly [K in keyof TEnvSchema]: string | number | boolean;
};
