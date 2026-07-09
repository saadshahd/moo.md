import { useDrag } from "@use-gesture/react";
import { Application } from "@pixi/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { WorldCanvas } from "../viewport/canvas/index.tsx";
import { useSimulation } from "./use-simulation.ts";
import { TraitEditor } from "./TraitEditor.tsx";
import { SeedDisplay } from "./SeedDisplay.tsx";
import { StartButton } from "./StartButton.tsx";
import {
  baseElevationAtom,
  baseBiomesAtom,
  LAND_BIOME,
  DEFAULT_TRAITS,
  foundersAtom,
  phaseAtom,
  selectedFounderIdxAtom,
  terrainDeltasAtom,
} from "./setup.atoms.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../primitives/index.ts";
import { TILE_SIZE } from "../viewport/constants.ts";
import styles from "./app.module.css";

export function App() {
  const { snapshot, onTick, running, toggle, onSave, onLoad, sim } =
    useSimulation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const phase = useAtomValue(phaseAtom);
  const baseElevation = useAtomValue(baseElevationAtom);
  const baseBiomes = useAtomValue(baseBiomesAtom);
  const [founders, setFounders] = useAtom(foundersAtom);
  const [terrainDeltas, setTerrainDeltas] = useAtom(terrainDeltasAtom);
  const setSelectedFounderIdx = useSetAtom(selectedFounderIdxAtom);
  const selectedFounderIdx = useAtomValue(selectedFounderIdxAtom);

  const bind = useDrag(
    ({ xy: [clientX, clientY], event }) => {
      if (phase !== "setup") return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const tileX = Math.floor((clientX - rect.left) / TILE_SIZE);
      const tileY = Math.floor((clientY - rect.top) / TILE_SIZE);
      if (
        tileX < 0 ||
        tileX >= WORLD_WIDTH ||
        tileY < 0 ||
        tileY >= WORLD_HEIGHT
      )
        return;
      const idx = tileY * WORLD_WIDTH + tileX;
      const shiftDown = (event as PointerEvent).shiftKey;
      const delta = shiftDown ? -1 : 1;
      setTerrainDeltas((prev) => {
        const next = new Map(prev);
        next.set(
          idx,
          Math.max(-150, Math.min(150, (next.get(idx) ?? 0) + delta)),
        );
        return next;
      });
    },
    { pointer: { touch: false } },
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== "setup") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const tileX = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const tileY = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    // Check if clicking on existing founder
    const clickedIdx = founders.findIndex(
      (f) => Math.abs(f.x - tileX) < 1 && Math.abs(f.y - tileY) < 1,
    );
    if (clickedIdx !== -1) {
      setSelectedFounderIdx(clickedIdx);
      return;
    }

    // baseBiomes from seed — doesn't account for painted deltas, close enough for placement guards
    const idx = tileY * WORLD_WIDTH + tileX;
    if (baseBiomes[idx] !== LAND_BIOME) return;

    setFounders((prev) => [
      ...prev,
      { x: tileX, y: tileY, traits: { ...DEFAULT_TRAITS } },
    ]);
  };

  return (
    <div className={styles["root"]}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          cursor: phase === "setup" ? "crosshair" : "default",
        }}
        {...bind()}
        onClick={handleClick}
      >
        <Application
          width={WORLD_WIDTH * TILE_SIZE}
          height={WORLD_HEIGHT * TILE_SIZE}
          background={0x111111}
        >
          <WorldCanvas
            snapshot={snapshot}
            onTick={onTick}
            running={running}
            phase={phase}
            baseElevation={baseElevation}
            terrainDeltas={terrainDeltas}
            founders={founders}
            selectedFounderIdx={selectedFounderIdx}
          />
        </Application>
        <TraitEditor />
        {phase === "setup" && <SeedDisplay />}
        {phase === "setup" && <StartButton sim={sim} />}
      </div>
      <output
        className={styles["hud"]}
        data-testid="sim-state"
        data-tick={snapshot?.tick ?? 0}
        data-hash={snapshot?.hash ?? ""}
      >
        <span>tick: {snapshot?.tick ?? 0}</span>
        {" · "}
        <span>hash: {snapshot?.hash ?? "—"}</span>
        {" · "}
        {phase === "observation" && (
          <button onClick={toggle}>{running ? "pause" : "start"}</button>
        )}
        {" · "}
        <button onClick={() => void onSave()}>save</button>
        {" · "}
        <button onClick={() => fileInputRef.current?.click()}>load</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".lzs,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onLoad(file);
            e.target.value = "";
          }}
        />
// [trimmed]
