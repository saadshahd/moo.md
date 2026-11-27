/**
 * What Claude Code 2.1.323 hands a `PostToolUse` hook once the owner answered an AskUserQuestion, as measured on a real
 * session: what they picked or typed comes back under the question's words, with no mark of which it was.
 */
export const answeredHook = (answer: string, question = "Approve this change?") => {
	const questions = [{ question, header: "Approve", options: [{ label: "approve", description: "Approve the change" }, { label: "run again", description: "Run it again" }], multiSelect: false }];
	const answered = { questions, answers: { [question]: answer }, annotations: {} };

	return { hook_event_name: "PostToolUse", permission_mode: "auto", tool_name: "AskUserQuestion", tool_input: answered, tool_response: answered, tool_use_id: "toolu_016W55TqThPWirNGVz8B4zfj", duration_ms: 1 };
};

export type AnsweredHook = ReturnType<typeof answeredHook>;
