export const meta = {
  name: 'hope-consult',
  description: 'Parallel expert simulation — one word-capped agent per profile, positions returned for main-loop synthesis',
  phases: [{ title: 'Consult', detail: 'one agent per expert profile', model: 'sonnet' }],
  decisions: {
    'fan-out': { chosen: '2-4 experts, one sonnet agent per profile', by: 'author', why: 'proven template: 4-expert sonnet run took 1.6 min, zero complaints; uncapped opus runs took 10-62 min' },
    'verification': { chosen: 'none', by: 'author', why: 'advisory output; the user verifies at the AskUserQuestion step' },
    'output-caps': { chosen: 'schema-capped: max 3 concerns per expert, char-capped fields', by: 'author', why: 'uncapped expert output drew fluff complaints' },
    'coverage': { chosen: 'profiles selected via domain map in conversation before invoking', by: 'author', why: 'selection is visible in the routing step; nothing invented inside the workflow' },
    'concurrency': { chosen: 'single parallel barrier; wall-time = slowest expert', by: 'author', why: 'experts are independent and synthesis needs all positions — the barrier is genuine' },
    'narration': { chosen: 'completion counter as each expert returns', by: 'author', why: 'silent runs get killed' },
  },
}

const POSITION = {
  type: 'object',
  additionalProperties: false,
  required: ['concerns', 'dissent'],
  properties: {
    concerns: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['concern', 'suggestion', 'why', 'gain', 'pay'],
        properties: {
          concern: { type: 'string', maxLength: 80, description: 'the decision the user faces' },
          suggestion: { type: 'string', maxLength: 120, description: 'conclusion first — what to do' },
          why: { type: 'string', maxLength: 200, description: 'why it matters / cost of ignoring' },
          gain: { type: 'string', maxLength: 100 },
          pay: { type: 'string', maxLength: 100 },
        },
      },
    },
    dissent: { type: 'string', maxLength: 200, description: 'where this expert pushes back against the likely consensus' },
  },
}

const { question, context = '', mode = 'panel', profiles } = args ?? {}
if (!question || !profiles?.length) throw new Error('args required: { question, profiles: [{ name, path }], context?, mode? }')

let done = 0
const positions = await parallel(profiles.map(p => () =>
  agent(
    `Read the expert profile at ${p.path}. Simulate this expert: argue from their documented positions applied to the question below, respecting their "Would NEVER Say" guardrails. For living figures, prefer your newer knowledge past the profile's Verified date. Mode: ${mode} — surface where this expert would disagree with conventional advice.

QUESTION: ${question}

CONTEXT: ${context || '(none provided)'}

Return at most 3 concerns, each grounded in this expert's published work. Be terse — every field is capped and overruns fail validation.`,
    { label: `expert:${p.name}`, phase: 'Consult', model: 'sonnet', schema: POSITION },
  ).then(r => {
    log(`${++done}/${profiles.length} experts done`)
    return r && { expert: p.name, ...r }
  }),
))

return { positions: positions.filter(Boolean) }
