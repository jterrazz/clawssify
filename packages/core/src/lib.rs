pub mod ai;
pub mod config;
pub mod engine;
pub mod markdown;
pub mod models;
pub mod search;
pub mod storage;

use config::EngineConfig;
use models::*;
use std::sync::Arc;

/// Core error type.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("I/O error: {msg}")]
    Io { msg: String },
    #[error("Network error: {msg}")]
    Network { msg: String },
    #[error("AI provider error: {msg}")]
    AiProvider { msg: String },
    #[error("Parse error: {msg}")]
    Parse { msg: String },
    #[error("Storage error: {msg}")]
    Storage { msg: String },
    #[error("Config error: {msg}")]
    Config { msg: String },
    #[error("Search error: {msg}")]
    Search { msg: String },
    #[error("Content extraction error: {msg}")]
    ContentExtraction { msg: String },
}

impl From<std::io::Error> for CoreError {
    fn from(e: std::io::Error) -> Self {
        CoreError::Io { msg: e.to_string() }
    }
}

impl From<reqwest::Error> for CoreError {
    fn from(e: reqwest::Error) -> Self {
        CoreError::Network { msg: e.to_string() }
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(e: serde_json::Error) -> Self {
        CoreError::Parse { msg: e.to_string() }
    }
}

/// The main Clawssify engine.
pub struct ClawssifyEngine {
    config: EngineConfig,
    runtime: tokio::runtime::Runtime,
}

impl ClawssifyEngine {
    /// Ingest content and run the full pipeline.
    pub fn ingest(&self, payload: IngestPayload) -> Result<ProcessingResult, CoreError> {
        self.runtime.block_on(async {
            let orchestrator = engine::orchestrator::Orchestrator::new(&self.config)?;
            orchestrator.process(payload).await
        })
    }

    /// Get the knowledge tree.
    pub fn get_knowledge_tree(&self) -> Result<Vec<KnowledgeTreeNode>, CoreError> {
        self.runtime.block_on(async {
            let knowledge = storage::knowledge::KnowledgeStorage::new(&self.config.data_dir);
            knowledge.get_tree().await
        })
    }

    /// Get all sources.
    pub fn get_sources(&self) -> Result<Vec<Source>, CoreError> {
        self.runtime.block_on(async {
            let sources = storage::sources::SourcesStorage::new(&self.config.data_dir);
            sources.get_all().await
        })
    }

    /// Search the knowledge base.
    pub fn search(&self, query: String) -> Result<Vec<String>, CoreError> {
        self.runtime.block_on(async {
            search::search_knowledge(&self.config.data_dir, &query).await
        })
    }
}

/// Create a new engine instance.
pub fn create_engine(config: EngineConfig) -> Result<Arc<ClawssifyEngine>, CoreError> {
    let rt = tokio::runtime::Runtime::new().map_err(|e| CoreError::Io { msg: e.to_string() })?;
    rt.block_on(storage::init::initialize_data_directory(&config.data_dir))?;

    Ok(Arc::new(ClawssifyEngine {
        config,
        runtime: rt,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_engine() {
        let dir = tempfile::tempdir().unwrap();
        let config = EngineConfig {
            data_dir: dir.path().to_string_lossy().to_string(),
            ai_provider: AiProviderType::Ollama,
            ai_api_key: None,
            ai_base_url: None,
            ai_model: None,
        };
        let engine = create_engine(config);
        assert!(engine.is_ok());
    }
}
