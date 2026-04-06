import { Capacitor } from "@capacitor/core";

/**
 * Returns true when the app is running inside a native Capacitor shell
 * (iOS or Android), false when running as a regular web app / PWA.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform: "ios" | "android" | "web".
 */
export function getPlatform(): "ios" | "android" | "web" {
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}

/**
 * Resolves the correct API base URL depending on the runtime environment.
 * - Native apps always target the production API.
 * - Web falls back to the NEXT_PUBLIC_API_URL env variable or localhost.
 */
export function getApiUrl(): string {
  if (isNative()) {
    return "https://api.kickoff.app/api/v1";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
}
