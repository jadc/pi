import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const path = join(getAgentDir(), "last-model.json");

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const { provider, modelId } = JSON.parse(readFileSync(path, "utf8"));
      const model = ctx.modelRegistry.find(provider, modelId);
      if (model) await pi.setModel(model);
    } catch {
      // No saved model yet.
    }
  });

  pi.on("model_select", (event) => {
    writeFileSync(
      path,
      JSON.stringify(
        { provider: event.model.provider, modelId: event.model.id },
        null,
        2,
      ) + "\n",
    );
  });
}
