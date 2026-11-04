// tend's band layout (hunch/hooks/band.tsx), for the site and its checks alike.
// Vite loads band.tsx as the module it is; tsx, which runs the checks, loads
// it as CommonJS, since no package.json above hunch's hooks names them
// modules, and hands its exports over as one default object.
import * as loaded from "../../../hunch/hooks/band.tsx";

const band: typeof loaded =
  "layout" in loaded
    ? loaded
    : (loaded as unknown as { default: typeof loaded }).default;
export const { layout, MEASURE } = band;
export type { Band, Cell, Item } from "../../../hunch/hooks/band.tsx";
