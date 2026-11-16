export const pluginSource = (checks) => {
  const imports = checks.map(({ specifier }, index) => `import check${index} from ${JSON.stringify(specifier)};`);
  const entries = checks.map(({ rule }, index) => `${JSON.stringify(rule)}: check${index}`);
  return `${imports.join('\n')}
export default { meta: { name: 'sound' }, rules: { ${entries.join(', ')} } };
`;
};
