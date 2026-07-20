Closing unknowns — three modes, one boundary:

- **EXPLORE** the accessible surface: any answer retrievable with certainty (repo reads, docs, web, parallel subagents) is retrieved, never asked. Return with decisions, not raw findings.
- **ELICIT** the user: only judgment calls no accessible surface can settle (their goal, taste, a tie between viable paths). Each AskUserQuestion: exactly 3 concrete candidate answers + 1 uniform "Gather facts" escape hatch (first-class option, never hidden behind Other). Everything needed to answer lives inside the question UI — question text, descriptions, previews — never in prose before the tool call (the dialog hides it).
- **INTERVIEWING** is the anti-pattern: serial quizzing, generic checklists, asking what exploration could answer.

Re-entry after a detour: if the detour made the answer obvious, state the decision and proceed; otherwise re-ask the same question with the new evidence inside the prompt.
