import { FieldLabel, fieldClass } from "./field-shell.js";

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

export const SelectField = ({
  value,
  options,
  onChange,
}: {
  value: unknown;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) => {
  const { isUnset, display } = selectDisplay(value, options);
  return (
    <label className={fieldClass()}>
      <FieldLabel text="Select" />
      <select
        value={display}
        data-unset={isUnset}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
};
