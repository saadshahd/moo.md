import { useState } from "react";

// parseTimecode :: string => number | undefined
export const parseTimecode = (s: string): number | undefined => {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export const TimecodeInput = ({ onSeek }: { onSeek: (tick: number) => void }) => {
  const [timecode, setTimecode] = useState("");
  const [timecodeError, setTimecodeError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const tick = parseTimecode(timecode.trim());
    if (tick === undefined) {
      setTimecodeError(true);
      return;
    }
    onSeek(tick);
  };

  return (
    <form onSubmit={submit}>
      <input
        data-error={timecodeError}
        value={timecode}
        onChange={(e) => setTimecode(e.target.value)}
      />
    </form>
  );
};
