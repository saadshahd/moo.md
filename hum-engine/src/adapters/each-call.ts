type Wrap = <A extends unknown[], R>(call: (...args: A) => Promise<R>, name: string) => (...args: A) => Promise<R>;

/**
 * `role` with each of its calls passed through `wrap`, and its other members kept.
 * SAFETY: every member of an integration role that is a function is an async method, and `wrap` keeps its
 * parameters; the caller names the role type the wrapped calls answer as.
 */
export const eachCall = <R extends object, W extends object>(role: R, wrap: Wrap): W =>
	Object.fromEntries(Object.entries(role).map(([name, member]) => [name, member instanceof Function ? wrap(async (...args: unknown[]) => member.apply(role, args), name) : member])) as W;
