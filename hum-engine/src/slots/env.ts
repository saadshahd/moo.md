import { basename, join, resolve } from "node:path";
import type { HumConfig } from "../config/schema.ts";

/** The variables a slot's recipe commands, repo checks and runs read. The recipe is written against these names. */
export const SLOT_ENV = {
	slot: "HUM_SLOT",
	folder: "HUM_SLOT_FOLDER",
	portBase: "HUM_SLOT_PORT_BASE",
	database: "HUM_SLOT_DATABASE",
	composeProject: "COMPOSE_PROJECT_NAME",
} as const;

export type SlotIdentity = { readonly name: string; readonly index: number; readonly folder: string };

type Settings = Pick<HumConfig["runSlots"], "services" | "ports" | "projectPrefix">;

const NOT_NAME_CHARACTER = /[^A-Za-z0-9]+/g;

/** The name of the slot at this position among the slots. */
export const slotName = (index: number): string => `slot-${index + 1}`;

/** Where a slot's worktree is: in the pool folder, named for the checkout it belongs to and the slot. */
export const slotFolder = (repo: string, pool: string, name: string): string => join(resolve(repo, pool), `${basename(repo)}-${name}`);

const isShared = ({ services }: Settings): boolean => services === "shared";

/** The port a slot's services start from: the start of its own block, or the one block every slot shares. */
const portBaseOf = (settings: Settings, index: number): number => settings.ports.base + (isShared(settings) ? 0 : index * settings.ports.stride);

/** One compose project for the slot, or for all slots when they share one set of services. */
const projectOf = (settings: Settings, name: string): string => `${settings.projectPrefix}-${isShared(settings) ? "shared" : name}`;

/** The database only this slot's runs reach on a shared set of services. */
const databaseOf = ({ projectPrefix }: Settings, name: string): string => `${projectPrefix}_${name}`.replace(NOT_NAME_CHARACTER, "_");

export const slotEnv = (settings: Settings, { name, index, folder }: SlotIdentity) => ({
	[SLOT_ENV.slot]: name,
	[SLOT_ENV.folder]: folder,
	[SLOT_ENV.portBase]: String(portBaseOf(settings, index)),
	[SLOT_ENV.database]: databaseOf(settings, name),
	[SLOT_ENV.composeProject]: projectOf(settings, name),
});
