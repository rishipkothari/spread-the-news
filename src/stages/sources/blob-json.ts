import { loadSources } from "@/sources/store";
import type { SourceRegistry } from "../types";

/** Sources from the admin-editable Blob copy, falling back to the repo's config/sources.json. */
export const blobJsonRegistry: SourceRegistry = {
  id: "blob-json",
  async getSources() {
    const { sources } = await loadSources();
    return sources.filter((s) => s.enabled);
  },
};
