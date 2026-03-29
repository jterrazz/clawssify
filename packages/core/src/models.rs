use serde::{Deserialize, Serialize};

/// Content type for ingestion — mirrors `packages/shared/src/types/ingest.ts`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContentType {
    Url,
    Text,
    Tweet,
    Conversation,
    Note,
}

/// Impact mode requested by the user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ImpactMode {
    Auto,
    Bookmark,
    Standard,
    Deep,
}

/// Resolved impact after AI decision (Auto is resolved to one of these).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResolvedImpact {
    Bookmark,
    Standard,
    Deep,
}

/// Source processing status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SourceStatus {
    Processing,
    Processed,
    Bookmarked,
    Pending,
    Failed,
}

/// AI provider type selection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AiProviderType {
    Anthropic,
    OpenAi,
    Ollama,
}

/// Payload for ingesting new content — mirrors `IngestPayload` from shared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestPayload {
    pub content_type: ContentType,
    pub content: String,
    pub tags: Option<Vec<String>>,
    pub impact: Option<ImpactMode>,
}

/// Result of AI processing — mirrors `ProcessingResult` from shared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingResult {
    pub source_title: String,
    pub impact: ResolvedImpact,
    pub files_created: Vec<String>,
    pub files_modified: Vec<String>,
    pub summary: String,
}

/// A source entry in sources.json — mirrors `Source` from shared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub id: String,
    pub url: Option<String>,
    pub content_type: ContentType,
    pub ingested_at: String,
    pub title: String,
    pub analysis_path: String,
    pub knowledge_pages: Vec<String>,
    pub concepts: Vec<String>,
    pub impact: ResolvedImpact,
    pub status: SourceStatus,
    pub tags: Option<Vec<String>>,
}

/// A node in the knowledge tree for navigation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeTreeNode {
    pub path: String,
    pub title: String,
    pub children: Vec<KnowledgeTreeNode>,
}

/// Tool definition passed to AI providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// A tool call from the AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Result of executing a tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub name: String,
    pub result: String,
    #[serde(default)]
    pub is_error: bool,
}

/// Brain context loaded from .brain/ files.
#[derive(Debug, Clone)]
pub struct BrainContext {
    pub system: String,
    pub structure: String,
    pub decisions: String,
    pub knowledge_tree: Vec<String>,
}

/// Extracted content from a URL or text input.
#[derive(Debug, Clone)]
pub struct ExtractedContent {
    pub title: String,
    pub text: String,
    pub url: Option<String>,
}

/// A content entry for serving pages (replaces site's content.ts types).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentEntry {
    pub slug: Vec<String>,
    pub title: String,
    pub content: String,
    pub frontmatter: serde_json::Value,
    pub section: String,
    pub last_modified: String,
}

/// A sidebar navigation item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarItem {
    pub title: String,
    pub href: Option<String>,
    pub children: Vec<SidebarItem>,
}
