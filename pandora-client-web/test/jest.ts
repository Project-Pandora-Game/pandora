/** Keep browser tests on browser-only types while exposing Jest's ESM-injected API. */
export const jest = import.meta.jest;

type UnstableMockModule = (
	moduleName: string,
	moduleFactory: () => unknown | Promise<unknown>,
	options?: { virtual?: boolean; },
) => typeof jest;

const jestWithEsmModuleMocking = jest as typeof jest & Record<'unstable_mockModule', UnstableMockModule>;

/** Mock a client source module in ESM tests. */
export function MockClientModule(
	moduleName: string,
	moduleFactory: () => unknown | Promise<unknown>,
	options?: { virtual?: boolean; },
): typeof jest {
	return jestWithEsmModuleMocking.unstable_mockModule(`../src/${ moduleName }`, moduleFactory, options);
}
