type Band = { start: number; end: number };
type Measured = { band: Band };
type Carved = { band: Band };

export const carveBands = (carved: Carved[], measuredOrdered: Measured[]): void => {
  for (const c of carved) {
    for (const m of measuredOrdered) {
      if (m.band.start >= c.band.end || m.band.end <= c.band.start) continue;
      if (m.band.start >= c.band.start && m.band.end <= c.band.end) {
        m.band = { start: c.band.start, end: c.band.start };
        continue;
      }
      if (c.band.start <= m.band.start) m.band.start = Math.max(m.band.start, c.band.end);
      else if (c.band.end >= m.band.end) m.band.end = Math.min(m.band.end, c.band.start);
      else {
        m.band.end = c.band.start;
      }
    }
  }
};
