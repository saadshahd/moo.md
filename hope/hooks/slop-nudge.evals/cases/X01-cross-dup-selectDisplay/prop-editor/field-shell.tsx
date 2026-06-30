/**
 * Leaf module for shared field building blocks: the label + readonly badge,
 * the field wrapper class, and the membership-derived select state. Both the
 * native renderers in puck-fields.tsx and the registered control renderers in
 * controls/ import from here, so nothing in this module may import from either —
 * that is what keeps the control registry off the puck-fields cycle:
 *   puck-fields.tsx → controls/index.ts → controls/segmented.tsx → field-shell.tsx
 * (field-shell imports nothing back, so the chain terminates — no cycle).
 */

export const FieldLabel = ({
  text,
  readOnly,
}: {
  text: string;
  readOnly?: boolean;
}) => (
  <label>
    {text}
    {readOnly && (
      <span className="prop-readonly-badge" data-role="readonly-badge">
        <svg width="9" height="11" viewBox="0 0 9 11" aria-hidden>
          <path
            d="M2 5V3a2.5 2.5 0 0 1 5 0v2"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
          <rect x="1" y="5" width="7" height="5" rx="1" fill="currentColor" />
        </svg>
      </span>
    )}
  </label>
);

export const fieldClass = (readOnly?: boolean) =>
  `prop-field${readOnly ? " prop-field--readonly" : ""}`;

/** Membership-derived select state: a value counts as "set" only when it is one
 *  of the catalog's option values (so an explicit empty-string option is honest,
 *  and an absent/foreign value shows the synthetic placeholder, never option[0]). */
export const selectDisplay = (
  value: unknown,
  options: readonly { value: unknown }[],
): { isUnset: boolean; display: string } => {
  const current = String(value ?? "");
  const isUnset = !options.some((o) => String(o.value) === current);
  return { isUnset, display: isUnset ? "" : current };
};

export type ValueMode =
  | { mode: "preset"; key: string }
  | { mode: "literal"; value: string }
  | { mode: "unset" };

/** Classify a field value against a known preset list.
 *  - unset: value is undefined or an empty string
 *  - preset: non-empty string that exactly matches one of the presets
 *  - literal: any other non-empty value (off-grid, not in preset list) */
export const resolveValueMode = (
  value: unknown,
  presets: string[],
): ValueMode => {
  if (value === undefined || value === "") return { mode: "unset" };
  const str = String(value);
  if (str === "") return { mode: "unset" };
  if (presets.includes(str)) return { mode: "preset", key: str };
  return { mode: "literal", value: str };
};
