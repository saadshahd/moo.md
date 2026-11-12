import type { RepeatGroup } from "./records.ts";
import { checkNameOf } from "./check-item.ts";

/** The text of CI runs that started after a time; the integration reads them from the CI provider. */
export type CiLogs = (since: number) => Promise<readonly string[]>;

/** Whether a CI log names the check: the next run after the check landed proves it ran. */
export const doesLogName = (log: string, groupKey: RepeatGroup["key"]): boolean => log.includes(checkNameOf(groupKey));
