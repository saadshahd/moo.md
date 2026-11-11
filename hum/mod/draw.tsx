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

/** One box per row, one child per span; a span with a press is a button. The row's width was fixed by its renderer. */
export const drawRows = ({ Box, Text, Button }: Tags, rows: readonly Row[], onPress: (press: Press) => void): RenderElement => (
	<Box flexDirection="column">
		{rows.map((row, y) => (
			<Box key={`row-${y}`} flexDirection="row">
				{row.map((part, x) => drawSpan({ Text, Button }, part, `${y}-${x}`, onPress))}
			</Box>
		))}
	</Box>
);

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

const drawSpan = ({ Text, Button }: Pick<Tags, "Text" | "Button">, { text, tone, press }: Span, key: string, onPress: (press: Press) => void): RenderElement =>
	press === undefined ? (
		<Text {...(tone === "filled" ? {} : TONE[tone])} wrap="truncate-end">
			{text}
		</Text>
	) : (
		<Button key={key} plain onPress={() => onPress(press)}>
			{tone === "filled" ? drawFilled({ Text }, text) : <Text {...TONE[tone]}>{text}</Text>}
		</Button>
	);
