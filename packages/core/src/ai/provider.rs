//! AIProvider trait + factory — port of `server/src/services/ai/provider.ts`.

use crate::config::EngineConfig;
use crate::models::*;
use crate::CoreError;
use std::future::Future;
use std::pin::Pin;

/// Trait that all AI providers implement.
pub trait AiProvider: Send + Sync {
    fn process<'a>(
        &'a self,
        system_prompt: &'a str,
        user_prompt: &'a str,
        tools: &'a [ToolDefinition],
        execute_tool: &'a (dyn Fn(ToolCall) -> Pin<Box<dyn Future<Output = ToolResult> + Send>>
                  + Send
                  + Sync),
    ) -> Pin<Box<dyn Future<Output = Result<ProcessingResult, CoreError>> + Send + 'a>>;
}

/// Factory to create the appropriate AI provider based on config.
pub fn create_ai_provider(config: &EngineConfig) -> Result<Box<dyn AiProvider>, CoreError> {
    match config.ai_provider {
        AiProviderType::Anthropic => Ok(Box::new(super::anthropic::AnthropicProvider::new(
            config.ai_api_key.clone().ok_or(CoreError::Config {
                msg: "Anthropic API key required".into(),
            })?,
            config.model().to_string(),
        ))),
        AiProviderType::OpenAi => Ok(Box::new(super::openai::OpenAiProvider::new(
            config.ai_api_key.clone().ok_or(CoreError::Config {
                msg: "OpenAI API key required".into(),
            })?,
            config.model().to_string(),
            config.ai_base_url.clone(),
        ))),
        AiProviderType::Ollama => Ok(Box::new(super::ollama::OllamaProvider::new(
            config
                .ai_base_url
                .clone()
                .unwrap_or_else(|| "http://localhost:11434".into()),
            config.model().to_string(),
        ))),
    }
}
