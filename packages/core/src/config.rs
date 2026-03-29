use crate::models::AiProviderType;
use serde::{Deserialize, Serialize};

/// Engine configuration — mirrors `AppConfig` from shared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub data_dir: String,
    pub ai_provider: AiProviderType,
    pub ai_api_key: Option<String>,
    pub ai_base_url: Option<String>,
    pub ai_model: Option<String>,
}

impl EngineConfig {
    /// Return the AI model string, falling back to a sensible default per provider.
    pub fn model(&self) -> &str {
        self.ai_model.as_deref().unwrap_or(match self.ai_provider {
            AiProviderType::Anthropic => "claude-sonnet-4-5-20250929",
            AiProviderType::OpenAi => "gpt-4o",
            AiProviderType::Ollama => "llama3.1",
        })
    }
}
