import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";

function buildHeader(theme: Theme): string[] {
  const asciiArt = [
    "   ███████████████████████████╗  ",
    "   ╚══██████╔════════██████╔══╝  ",
    "      ██████║        ██████║     ",
    "      ██████║        ██████║     ",
    "      ██████║        ██████║     ",
    "      ██████║        ██████║     ",
    "      ██████║        ██████║     ",
    "      ██████║        ██████║     ",
    "   ████████████╗  ████████████╗  ",
    "   ╚═══════════╝  ╚═══════════╝  ",
  ];

  return ["", ...asciiArt, "", `pi v${VERSION}`].map((line) =>
    theme.bold(theme.fg("accent", line)),
  );
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui, theme) => ({
      render: () => buildHeader(theme),
      invalidate() {},
    }));
  });
}
