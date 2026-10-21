/** Empty permission lists must never be mistaken for a complete restriction. */
export function allGeneratorModulesDisabled(
  moduleKeys: readonly string[],
  disabledModules: ReadonlySet<string>,
): boolean {
  return moduleKeys.length > 0 && moduleKeys.every(key => disabledModules.has(key));
}