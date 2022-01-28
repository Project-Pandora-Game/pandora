/** Checks if the two types are equal */
export type Equals<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends
	(<T>() => T extends Y ? 1 : 2) ? true : false;

export type MembersFirstArg<T> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends ((arg: infer U, ...rest: any[]) => unknown) ? U : never;
};

export type MemberReturnType<T> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends ((...arg: any[]) => infer U) ? U : never;
};

export type BoolSelect<T extends boolean, TrueType, FalseType> = T extends true ? TrueType : FalseType;

declare const window: unknown;
declare const document: Record<string, unknown>;
declare const process: Record<string, Record<string, unknown>>;

/** True if the environment is a browser */
export const IS_BROWSER = typeof window === 'object' && typeof document === 'object' && document.nodeType === 9 && !(typeof process === 'object' && !!process.versions && !!process.versions.node);
/** True if the environment is a node */
export const IS_NODE = !IS_BROWSER;
