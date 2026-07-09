import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Remote } from "comlink";
import type { SimApi } from "../worker/api.ts";
import {
  seedAtom,
  foundersAtom,
  terrainDeltasAtom,
  phaseAtom,
} from "./setup.atoms.ts";

type Props = {
  readonly sim: Remote<SimApi> | null;
};

export function StartButton({ sim }: Props) {
  const seed = useAtomValue(seedAtom);
  const founders = useAtomValue(foundersAtom);
  const terrainDeltas = useAtomValue(terrainDeltasAtom);
  const setPhase = useSetAtom(phaseAtom);
  const startingRef = useRef(false);

  const handleStart = async () => {
    if (!sim || startingRef.current) return;
    startingRef.current = true;
    try {
      await sim.init({ seed, founders, terrainDeltas });
      setPhase("observation");
    } finally {
      startingRef.current = false;
    }
  };

  return (
    <button
      onClick={() => void handleStart()}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "#4488ff",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        padding: "4px 12px",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      Start →
    </button>
  );
}
