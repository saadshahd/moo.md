import { StrictMode, use, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app.tsx";
import type { Biome } from "./io/mods/index.ts";

// Module-level Promise — created once, stable across renders.
const biomesPromise: Promise<readonly Biome[]> = fetch(
  "/data/biomes.json",
).then((r) => r.json() as Promise<readonly Biome[]>);

function Root() {
  const biomes = use(biomesPromise);
  return <App biomes={biomes} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
