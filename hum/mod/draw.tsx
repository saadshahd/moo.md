import type { EngineInterface, RenderElement } from "claude-code";
import type { Press, Row, Span, Tone } from "./view/row.ts";

type Tags = ReturnType<EngineInterface["ui"]["resolve"]>;

const TONE: Readonly<Record<Tone, { readonly color?: "warning"; readonly dimColor?: true; readonly bold?: true }>> = {
	plain: {},
	dim: { dimColor: true },
	strong: { bold: true },
	amber: { color: "warning" },
};

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

const drawSpan = ({ Text, Button }: Pick<Tags, "Text" | "Button">, { text, tone, press }: Span, key: string, onPress: (press: Press) => void): RenderElement =>
	press === undefined ? (
		<Text {...TONE[tone]} wrap="truncate-end">
			{text}
		</Text>
	) : (
		<Button key={key} plain onPress={() => onPress(press)}>
			<Text {...TONE[tone]}>{text}</Text>
		</Button>
	);
