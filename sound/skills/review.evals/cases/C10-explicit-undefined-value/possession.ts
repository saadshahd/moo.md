type Open = { team: string; start: number };
type State = { segments: Open[]; open?: Open };

const close = (state: State): State =>
  state.open
    ? { segments: [...state.segments, state.open], open: undefined }
    : state;

const start = (state: State, team: string, at: number): State => ({
  segments: state.open ? [...state.segments, state.open] : state.segments,
  open: { team, start: at },
});

export const possession = (events: { team: string; at: number }[]): Open[] =>
  events.reduce<State>(
    (state, e) => start(close(state), e.team, e.at),
    { segments: [], open: undefined },
  ).segments;
