import { z } from "zod";
import { config } from "@/lib/config";
import { sha } from "@/lib/hash";
import { structuredCall } from "@/lib/llm";
import { ARTICLE_TYPES, CATEGORIES, type Article, type HistoryStory, type Story } from "@/lib/types";
import type { ClusterInput, ClusterResult, StoryClusterer } from "../types";
import { buildClusterUser, CLUSTER_SYSTEM } from "./prompt";

export const ClusterOutput = z.object({
  stories: z.array(
    z.object({
      title: z.string(),
      category: z.enum(CATEGORIES),
      secondaryCategory: z.enum(CATEGORIES).optional(),
      continuesStoryId: z.string().optional(),
      articles: z.array(z.object({ id: z.number().int(), type: z.enum(ARTICLE_TYPES) })),
    }),
  ),
});
export type ClusterOutput = z.infer<typeof ClusterOutput>;

/** Map the model's numeric ids back to articles; drop unknown/duplicate ids and empty stories. */
export function validateClusterOutput(
  out: ClusterOutput,
  articles: Article[],
  history: HistoryStory[],
): Omit<ClusterResult, "usage"> {
  const warnings: string[] = [];
  const used = new Set<string>();
  const articleTypes: ClusterResult["articleTypes"] = {};
  const stories: Story[] = [];

  for (const s of out.stories) {
    const ids: string[] = [];
    for (const ref of s.articles) {
      const art = articles[ref.id - 1];
      if (!art) {
        warnings.push(`unknown article id ${ref.id} in "${s.title}"`);
        continue;
      }
      if (used.has(art.id)) {
        warnings.push(`article ${ref.id} assigned twice; kept first ("${s.title}")`);
        continue;
      }
      used.add(art.id);
      ids.push(art.id);
      articleTypes[art.id] = ref.type;
    }
    if (!ids.length) {
      warnings.push(`dropped empty story "${s.title}"`);
      continue;
    }
    let continuesStoryId: string | undefined;
    if (s.continuesStoryId) {
      const h = history[Number(s.continuesStoryId.replace(/^h/, "")) - 1];
      if (h) continuesStoryId = h.id;
      else warnings.push(`unknown continuesStoryId ${s.continuesStoryId}`);
    }
    stories.push({
      id: `s-${sha([...ids].sort().join(","), 12)}`,
      title: s.title.trim(),
      category: s.category,
      secondaryCategory: s.secondaryCategory && s.secondaryCategory !== s.category ? s.secondaryCategory : undefined,
      articleIds: ids,
      continuesStoryId,
      headlineIndex: 0,
    });
  }
  return { stories, articleTypes, warnings };
}

export const llmSinglePass: StoryClusterer = {
  id: "llm-single-pass",
  async cluster({ articles, sources, history }: ClusterInput): Promise<ClusterResult> {
    const system = CLUSTER_SYSTEM.replace("{MIN_OUTLETS}", String(config.cluster.minOutletsPerStory));
    const { data, usage } = await structuredCall({
      model: config.models.cluster,
      system,
      user: buildClusterUser(articles, sources, history),
      schema: ClusterOutput,
      maxTokens: config.cluster.maxTokens,
      effort: config.cluster.effort as "low" | "medium" | "high",
    });
    return { ...validateClusterOutput(data, articles, history), usage };
  },
};
