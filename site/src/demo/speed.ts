/** The playback speed every demo player shares. Picking one saves it, so
 * each player on every page, in any tab, starts at it; a missing or unknown
 * saved value is 1×. Where the browser blocks storage, the pick lasts as long
 * as the page. */
export const SPEEDS = [0.5, 1, 1.5, 2];
const KEY = "moo.speed";

// Storage is blocked: a SecurityError on access, or a quota of none.
const blocked = (e: unknown) =>
  e instanceof DOMException && (e.name === "SecurityError" || e.name === "QuotaExceededError");

function saved(): number {
  try {
    const x = Number(localStorage.getItem(KEY));
    return SPEEDS.includes(x) ? x : 1;
  } catch (e) {
    if (blocked(e)) return 1;
    throw e;
  }
}

// Read on first use, in the browser; the build only takes SPEEDS.
let speed: number | undefined;
const players = new Set<(x: number) => void>();

export const currentSpeed = () => (speed ??= saved());

/** Calls `follow` with each speed picked from now on, in any player here. */
export const followSpeed = (follow: (x: number) => void) => players.add(follow);

export function pickSpeed(x: number) {
  speed = x;
  try {
    localStorage.setItem(KEY, String(x));
  } catch (e) {
    if (!blocked(e)) throw e;
  }
  players.forEach((follow) => follow(x));
}
