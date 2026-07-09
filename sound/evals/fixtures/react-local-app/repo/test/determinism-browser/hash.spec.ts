import { test, expect } from "@playwright/test";

// IEEE 754 correctly-rounded values. Any deviation means V8 is not spec-compliant.
const MATH_PROBES: Array<[string, number]> = [
  ["Math.cos(1.0)", 0.5403023058681398],
  ["Math.sin(1.0)", 0.8414709848078965],
  ["Math.sqrt(2.0)", 1.4142135623730951],
];

test("Math.cos / Math.sin / Math.sqrt are IEEE 754 bit-identical", async ({
  page,
}) => {
  await page.goto("/");

  const results = await page.evaluate(
    (probes) =>
      probes.map(([label, expected]) => ({
        label,
        actual: eval(label as string) as number,
        expected,
        match: eval(label as string) === expected,
      })),
    MATH_PROBES,
  );

  for (const { label, actual, expected, match } of results) {
    expect(match, `${label}: got ${actual}, expected ${expected}`).toBe(true);
  }
});
