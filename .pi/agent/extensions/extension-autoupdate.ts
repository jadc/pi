import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Run at most once per Pi process, even if multiple sessions are opened.
  let started = false;

  pi.on("session_start", () => {
    if (started) return;
    started = true;

    try {
      const piEntryPoint = process.argv[1];
      if (!piEntryPoint) {
        console.error("Could not start background update: Pi CLI entry point is unavailable.");
        return;
      }

      const child = spawn(process.execPath, [piEntryPoint, "update", "--extensions"], {
        detached: true,
        stdio: "ignore",
      });

      child.once("error", (error) => {
        console.error("Could not start background update:", error);
      });
      child.unref();
    } catch (error) {
      console.error("Could not start background update:", error);
    }
  });
}
