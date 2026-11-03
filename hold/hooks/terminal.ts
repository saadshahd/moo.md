/** The environment variables that tell which terminal the session draws in. */
export type TermEnv = {
  TERM_PROGRAM?: string;
  TERM_PROGRAM_VERSION?: string;
  TERM?: string;
  KITTY_WINDOW_ID?: string;
  ROUNDUP_TERMINAL?: string;
  TMUX?: string;
  CLAUDE_CODE_FORCE_TERMINAL_IMAGES?: string;
};

const atLeast = (version: string | undefined, major: number, minor: number) => {
  const [a = 0, b = 0] = (version ?? "").split(".").map(Number);

  return a > major || (a === major && b >= minor);
};

/**
 * Whether Claude Code's `Image` draws pixels here, as its 2.1.316 types say: kitty and Ghostty,
 * and iTerm2 3.5 or later under fullscreen rendering. Claude Code asks the terminal itself (a
 * kitty graphics query, XTVERSION); hold cannot see the answers, so it reads the variables that
 * name the terminal. roundup answers XTVERSION as iTerm2 3.5 does, whatever it inherited. A
 * `TERM_PROGRAM` names the program; `TERM` may name terminfo it borrowed, as Solo borrows
 * Ghostty's, so it counts only where no program is named. tmux needs passthrough settings this
 * cannot see, so it counts as none.
 */
export function drawsPixels(env: TermEnv, isFullscreen: boolean): boolean {
  if (env.ROUNDUP_TERMINAL) return isFullscreen;
  if (env.TERM_PROGRAM === "iTerm.app")
    return isFullscreen && atLeast(env.TERM_PROGRAM_VERSION, 3, 5);
  if (env.TMUX) return false;
  if (/^(1|true|yes|on)$/i.test(env.CLAUDE_CODE_FORCE_TERMINAL_IMAGES ?? ""))
    return true;
  if (env.TERM_PROGRAM) return env.TERM_PROGRAM === "ghostty";

  return (
    env.TERM === "xterm-kitty" ||
    env.TERM === "xterm-ghostty" ||
    env.KITTY_WINDOW_ID !== undefined
  );
}
