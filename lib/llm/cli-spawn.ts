import { extname } from "node:path";

export function needsWindowsShell(bin: string): boolean {
  if (process.platform !== "win32") return false;
  const ext = extname(bin).toLowerCase();
  return ext === ".cmd" || ext === ".bat";
}
