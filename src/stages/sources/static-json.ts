import { staticSources } from "@/lib/config";
import type { SourceRegistry } from "../types";

export const staticJsonRegistry: SourceRegistry = {
  id: "static-json",
  async getSources() {
    return staticSources.filter((s) => s.enabled);
  },
};
