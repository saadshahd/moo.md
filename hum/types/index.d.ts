/** What the poller last found at the status file's path. */
export type ViewSource =
	| { kind: "waiting" }
	| { kind: "missing"; path: string }
	| { kind: "text"; text: string }
	| { kind: "failed"; message: string };

declare module "claude-code" {
	interface PluginState {
		hum: {
			source: Shaped<ViewSource>;
			unfolded: Shaped<string[]>;
		};
	}
}
