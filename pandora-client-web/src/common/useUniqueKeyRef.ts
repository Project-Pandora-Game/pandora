const KEY_REF_MAP = new Map<string, React.MutableRefObject<unknown>>();

export function useUniqueKeyRef<T>(key: string, value: T): React.MutableRefObject<T> {
	let ref = KEY_REF_MAP.get(key);
	if (!ref) {
		ref = { current: value };
		KEY_REF_MAP.set(key, ref);
	}
	return ref as React.MutableRefObject<T>;
}
