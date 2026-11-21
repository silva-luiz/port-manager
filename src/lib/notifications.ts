import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

/** True when Windows allows Port Manager to show notifications; asks if undecided. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

export function showNotification(title: string, body: string): void {
  sendNotification({ title, body });
}
