import type { SearchHit, LayerView } from "./types.js";

const MAX_RESULTS = 50;

export const searchHits = (query: string, layers: LayerView[]): SearchHit[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  for (const lv of layers) {
    for (const node of lv.nodes) {
      if (!node.fact.event.toLowerCase().includes(needle)) continue;
      hits.push({
        id: node.id,
        event: node.fact.event,
        layer: lv.name,
        team: node.fact.team,
      });
      if (hits.length >= MAX_RESULTS) return hits;
    }
  }
  return hits;
};
