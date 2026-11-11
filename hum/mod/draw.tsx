import type { EngineInterface, RenderElement } from "claude-code";
import type { Press, Row, Span, Tone } from "./view/row.ts";

type Tags = ReturnType<EngineInterface["ui"]["resolve"]>;

const TONE: Readonly<Record<Exclude<Tone, "filled">, { readonly color?: "warning"; readonly dimColor?: true; readonly bold?: true }>> = {
	plain: {},
	dim: { dimColor: true },
	strong: { bold: true },
	amber: { color: "warning" },
};

const ACCENT = "suggestion";

/** What a press does, as text: a button's address, which the focus ring follows from one drawing to the next. */
const addressOf = (press: Press): string => {
	switch (press.kind) {
		case "fill":
			return `fill:${press.item}:${press.word}`;
		case "fold":
			return `fold:${press.id}`;
		case "open":
			return "open";
	}
};

/**
 * One box per row, one child per span; a span with a press is a button. The row's width was fixed by its renderer.
 * A button's key is its press, never its place, so a card drawn above it leaves the focus on the same answer; the
 * spans of one entry that share a press are told apart by their order.
 */
export const drawRows = ({ Box, Text, Button }: Tags, rows: readonly Row[], onPress: (press: Press) => void): RenderElement => {
	const drawn = new Map<string, number>();

	const keyOf = (press: Press): string => {
		const address = addressOf(press);
		const count = (drawn.get(address) ?? 0) + 1;

		drawn.set(address, count);

		return count === 1 ? address : `${address}#${count}`;
	};

	return (
		<Box flexDirection="column">
			{rows.map((row, y) => (
				<Box key={`row-${y}`} flexDirection="row">
					{row.map((part) => drawSpan({ Text, Button }, part, keyOf, onPress))}
				</Box>
			))}
		</Box>
	);
};

/** A filled span's first and last cell are its caps, in the accent colour; between them the label is drawn on the accent. A Button holds only strings and Text, so the three are its children. */
const drawFilled = ({ Text }: Pick<Tags, "Text">, text: string): RenderElement[] => {
	const cells = Array.from(text);

	return [
		<Text key="lead" color={ACCENT}>
			{cells.at(0)}
		</Text>,
		<Text key="label" backgroundColor={ACCENT} color="inverseText" bold>
			{cells.slice(1, -1).join("")}
		</Text>,
		<Text key="tail" color={ACCENT}>
			{cells.at(-1)}
		</Text>,
	];
};

const drawSpan = ({ Text, Button }: Pick<Tags, "Text" | "Button">, { text, tone, press }: Span, keyOf: (press: Press) => string, onPress: (press: Press) => void): RenderElement =>
	press === undefined ? (
		<Text {...(tone === "filled" ? {} : TONE[tone])} wrap="truncate-end">
			{text}
		</Text>
	) : (
		<Button key={keyOf(press)} plain onPress={() => onPress(press)}>
			{tone === "filled" ? drawFilled({ Text }, text) : <Text {...TONE[tone]}>{text}</Text>}
		</Button>
	);
