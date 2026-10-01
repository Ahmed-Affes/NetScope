export const CRITICAL_PROCESS_NAMES = new Set([
  "system",
  "system idle process",
  "registry",
  "smss.exe",
  "csrss.exe",
  "wininit.exe",
  "winlogon.exe",
  "services.exe",
  "lsass.exe",
  "svchost.exe",
  "explorer.exe",
  "dwm.exe",
  "fontdrvhost.exe",
  "sihost.exe",
  "taskhostw.exe",
]);

export function isCriticalProcess(pid?: number | null, name?: string | null): boolean {
  if (pid !== undefined && pid !== null && pid <= 4) {
    return true;
  }
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  if (CRITICAL_PROCESS_NAMES.has(lower)) {
    return true;
  }
  const withExe = lower.endsWith(".exe") ? lower : `${lower}.exe`;
  return CRITICAL_PROCESS_NAMES.has(withExe);
}

export function getCriticalProcessReason(pid?: number | null, name?: string | null): string {
  if (pid !== undefined && pid !== null && pid <= 4) {
    return `PID ${pid} is a core Windows kernel/system process and cannot be terminated.`;
  }
  return `${name ?? "This process"} is a critical Windows system component required for OS stability. Termination is disabled.`;
}
