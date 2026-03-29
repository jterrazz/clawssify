//! Agentic AI orchestration loop — port of `server/src/services/ingest.service.ts`.

use crate::ai::provider::{create_ai_provider, AiProvider};
use crate::config::EngineConfig;
use crate::engine::content_extractor::extract_content;
use crate::engine::prompts::{build_user_prompt, SYSTEM_PROMPT};
use crate::engine::tools::{create_tool_executor, get_tool_definitions};
use crate::models::*;
use crate::storage::brain::BrainStorage;
use crate::storage::sources::SourcesStorage;
use crate::CoreError;
use tracing::info;

pub struct Orchestrator {
    ai_provider: Box<dyn AiProvider>,
    data_dir: String,
    #[allow(dead_code)]
    brain_storage: BrainStorage,
    sources_storage: SourcesStorage,
}

impl Orchestrator {
    pub fn new(config: &EngineConfig) -> Result<Self, CoreError> {
        let ai_provider = create_ai_provider(config)?;
        let data_dir = config.data_dir.clone();
        let brain_storage = BrainStorage::new(&data_dir);
        let sources_storage = SourcesStorage::new(&data_dir);

        Ok(Self {
            ai_provider,
            data_dir,
            brain_storage,
            sources_storage,
        })
    }

    pub async fn process(&self, payload: IngestPayload) -> Result<ProcessingResult, CoreError> {
        let source_id = generate_source_id();
        info!(source_id = %source_id, content_type = ?payload.content_type, "Starting ingestion");

        // 1. Extract content
        let extracted = extract_content(&payload.content_type, &payload.content).await?;
        info!(source_id = %source_id, title = %extracted.title, "Content extracted");

        // 2. Register source as processing
        let resolved_impact = match payload.impact.as_ref().unwrap_or(&ImpactMode::Auto) {
            ImpactMode::Auto => ResolvedImpact::Standard,
            ImpactMode::Bookmark => ResolvedImpact::Bookmark,
            ImpactMode::Standard => ResolvedImpact::Standard,
            ImpactMode::Deep => ResolvedImpact::Deep,
        };

        let source = Source {
            id: source_id.clone(),
            url: extracted.url.clone(),
            content_type: payload.content_type.clone(),
            ingested_at: chrono::Utc::now().to_rfc3339(),
            title: extracted.title.clone(),
            analysis_path: String::new(),
            knowledge_pages: vec![],
            concepts: vec![],
            impact: resolved_impact,
            status: SourceStatus::Processing,
            tags: payload.tags.clone(),
        };
        self.sources_storage.register_source(&source).await?;

        // 3. Build the user prompt
        let impact_str = match payload.impact.as_ref().unwrap_or(&ImpactMode::Auto) {
            ImpactMode::Auto => "auto",
            ImpactMode::Bookmark => "bookmark",
            ImpactMode::Standard => "standard",
            ImpactMode::Deep => "deep",
        };
        let user_prompt = build_user_prompt(
            &extracted.text,
            &format!("{:?}", payload.content_type).to_lowercase(),
            impact_str,
            extracted.url.as_deref(),
        );

        // 4. Run the AI with tools
        let tool_defs = get_tool_definitions();
        let tool_executor = create_tool_executor(&self.data_dir);

        let result = self
            .ai_provider
            .process(SYSTEM_PROMPT, &user_prompt, &tool_defs, &tool_executor)
            .await?;

        info!(source_id = %source_id, title = %result.source_title, "AI processing complete");

        // 5. Write analysis
        let analysis_content = format!(
            "# Analysis: {}\n\n{}\n\n## Files Created\n{}\n\n## Files Modified\n{}\n",
            result.source_title,
            result.summary,
            result
                .files_created
                .iter()
                .map(|f| format!("- {f}"))
                .collect::<Vec<_>>()
                .join("\n"),
            result
                .files_modified
                .iter()
                .map(|f| format!("- {f}"))
                .collect::<Vec<_>>()
                .join("\n"),
        );
        self.sources_storage
            .write_analysis(&source_id, &analysis_content)
            .await?;

        // 6. Update source status
        let new_status = match result.impact {
            ResolvedImpact::Bookmark => SourceStatus::Bookmarked,
            _ => SourceStatus::Processed,
        };
        self.sources_storage
            .update_source_status(&source_id, new_status)
            .await?;

        Ok(result)
    }
}

fn generate_source_id() -> String {
    format!("src_{}", uuid::Uuid::new_v4().to_string().replace('-', "")[..12].to_string())
}
