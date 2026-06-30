import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Window, Period, LaneView } from "./types.js";

type DragState = { x0: number; win0: Window };

export const DensityStrip = ({
  periods,
  lanes,
  onBrush,
}: {
  periods: Period[];
  lanes: LaneView[];
  onBrush: (w: Window) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<DragState | undefined>(undefined);
  const lastWinRef = useRef<Window | undefined>(undefined);
  const viewRef = useRef<Window | undefined>(undefined);
  const onBrushRef = useRef(onBrush);
  const stripHRef = useRef(0);
  const periodsRef = useRef(periods);
  const plotLeftRef = useRef(0);
  const plotRightRef = useRef(0);
  const lanesRef = useRef(lanes);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    onBrushRef.current = onBrush;
    periodsRef.current = periods;
    lanesRef.current = lanes;
  }, [onBrush, periods, lanes]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.x0;
      onBrushRef.current({ ...dragRef.current.win0, offset: dx });
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return <canvas ref={canvasRef} className="density-strip" />;
};
