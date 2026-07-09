import { useState, useEffect, useRef, useCallback } from "react";
import { useAtomValue } from "jotai";
import { wrap } from "comlink";
import type { Remote } from "comlink";
import type { SimApi } from "../worker/api.ts";
import type { WorldSnapshot } from "../primitives/index.ts";
import { Setup } from "../io/setup/index.ts";
import { seedAtom, phaseAtom } from "./setup.atoms.ts";

const spawnWorker = () =>
  wrap<SimApi>(
    new Worker(new URL("../worker/sim.worker.ts", import.meta.url), {
      type: "module",
    }),
  );

type SimState = {
  readonly snapshot: WorldSnapshot | null;
  readonly onTick: () => void;
  readonly running: boolean;
  readonly toggle: () => void;
  readonly onSave: () => Promise<void>;
  readonly onLoad: (file: File) => Promise<void>;
  readonly sim: Remote<SimApi> | null;
};

/**
 * Owns the simulation Worker and exposes the current snapshot.
 * Does NOT own the tick clock — Pixi's useTick drives it via WorldCanvas.
 */
export const useSimulation = (): SimState => {
  const seed = useAtomValue(seedAtom);
  const phase = useAtomValue(phaseAtom);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [sim, setSim] = useState<Remote<SimApi> | null>(null);
  const simRef = useRef<ReturnType<typeof spawnWorker> | null>(null);
  const inFlightRef = useRef(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const s = spawnWorker();
    simRef.current = s;
    setSim(s);
    void s
      .init({ seed })
      .then(() => s.snapshot())
      .then(setSnapshot);
    return () => {
      simRef.current = null;
      setSim(null);
    };
  }, [seed]);

  useEffect(() => {
    if (phase !== "observation" || !simRef.current) return;
    let cancelled = false;
    void simRef.current.snapshot().then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const onTick = useCallback(() => {
    if (phaseRef.current !== "observation") return;
    if (!simRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    void simRef.current.advance().then((s: WorldSnapshot) => {
      setSnapshot(s);
      inFlightRef.current = false;
    });
  }, []);

  const toggle = useCallback(() => setRunning((r) => !r), []);

  const onSave = useCallback(async () => {
    const sim = simRef.current;
    if (!sim) return;
    let compressed: string;
    try {
      compressed = await sim.exportSetup();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
      return;
    }
    const blob = new Blob([compressed], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "worldbox-setup.lzs";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const onLoad = useCallback(async (file: File) => {
    const sim = simRef.current;
    if (!sim) return;
    const raw = await file.text();
    const result = Setup.parse(raw);
    if (!result.ok) {
      alert(`Load failed: ${result.error.tag}`);
      return;
    }
    try {
      await sim.loadSetup(result.value);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Load failed");
      return;
    }
    const s = await sim.snapshot();
    setSnapshot(s);
  }, []);

  return {
    snapshot,
    onTick,
    running,
    toggle,
    onSave,
    onLoad,
    sim,
  };
};
