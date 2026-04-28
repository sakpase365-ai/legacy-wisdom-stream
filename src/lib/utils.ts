export function firstName(fullName: string | null | undefined): string | undefined {
  if (!fullName?.trim()) return undefined;
  return fullName.trim().split(/\s+/)[0];
}
