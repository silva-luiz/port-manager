/**
 * Drops the executable from a Windows command line, keeping only the
 * arguments. The executable is the first token, quoted when it contains
 * spaces (`"C:\Program Files\nodejs\node.exe" vite.js` → `vite.js`).
 */
export function commandArgs(commandLine: string): string {
  const text = commandLine.trim();
  const end = text.startsWith('"') ? text.indexOf('"', 1) + 1 : text.search(/\s/);
  return end > 0 ? text.slice(end).trim() : "";
}
