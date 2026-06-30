import { useState } from "react";
import type { SearchHit, LayerView } from "./types.js";

export const NavBar = ({
  layers,
  onZoom,
  onSelect,
  onSeek,
}: {
  layers: LayerView[];
  onZoom: (factor: number) => void;
  onSelect: (hit: SearchHit) => void;
  onSeek: (tick: number) => void;
}) => {
  const [timecode, setTimecode] = useState("");

  const handleZoomIn = () => onZoom(1.25);
  const handleZoomOut = () => onZoom(0.8);
  const handleSearchSelect = (hit: SearchHit) => onSelect(hit);
  const handleTimecodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tick = Number(timecode.trim());
    if (!Number.isNaN(tick)) onSeek(tick);
  };

  return (
    <nav className="navbar">
      <button onClick={handleZoomIn}>+</button>
      <button onClick={handleZoomOut}>-</button>
      <form onSubmit={handleTimecodeSubmit}>
        <input value={timecode} onChange={(e) => setTimecode(e.target.value)} />
      </form>
    </nav>
  );
};
