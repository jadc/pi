import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const path = join(getAgentDir(), "last-model.json");
type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;

function saveLastModel(
  provider: string,
  modelId: string,
  thinkingLevel: ThinkingLevel,
) {
  writeFileSync(
    path,
    JSON.stringify({ provider, modelId, thinkingLevel }, null, 2) + "\n",
  );
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const { defaultProvider, provider, modelId, thinkingLevel } = JSON.parse(
        readFileSync(path, "utf8"),
      ) as {
        defaultProvider?: string;
        provider?: string;
        modelId: string;
        thinkingLevel?: ThinkingLevel;
      };
      const savedProvider = defaultProvider ?? provider;
      const model = savedProvider
        ? ctx.modelRegistry.find(savedProvider, modelId)
        : undefined;
      if (model) {
        await pi.setModel(model);
        if (thinkingLevel) pi.setThinkingLevel(thinkingLevel);
      }
    } catch {
      // No saved model yet.
    }
  });

  pi.on("model_select", (event) => {
    saveLastModel(event.model.provider, event.model.id, pi.getThinkingLevel());
  });

  pi.on("thinking_level_select", (event, ctx) => {
    if (ctx.model) {
      saveLastModel(ctx.model.provider, ctx.model.id, event.level);
    }
  });
}
