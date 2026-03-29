import type { ContentType, ResolvedImpact } from "./ingest.js";

export type SourceStatus = "bookmarked" | "failed" | "pending" | "processed" | "processing";

export interface Source {
  id: string;
  url?: string;
  type: ContentType;
  ingestedAt: string;
  title: string;
  analysisPath: string;
  knowledgePages: string[];
  concepts: string[];
  impact: ResolvedImpact;
  status: SourceStatus;
  tags?: string[];
}
