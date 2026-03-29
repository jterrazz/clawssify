//! Ollama local HTTP client — OpenAI-compatible endpoint.

use crate::ai::provider::AiProvider;
use crate::models::*;
use crate::CoreError;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::pin::Pin;

pub struct OllamaProvider {
    base_url: String,
    model: String,
    client: reqwest::Client,
}

impl OllamaProvider {
    pub fn new(base_url: String, model: String) -> Self {
        Self {
            base_url,
            model,
            client: reqwest::Client::new(),
        }
    }
}

// Ollama uses OpenAI-compatible chat/completions endpoint

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<serde_json::Value>>,
    stream: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    message: ChatMessage,
}

impl AiProvider for OllamaProvider {
    fn process<'a>(
        &'a self,
        system_prompt: &'a str,
        user_prompt: &'a str,
        _tools: &'a [ToolDefinition],
        _execute_tool: &'a (dyn Fn(ToolCall) -> Pin<Box<dyn Future<Output = ToolResult> + Send>>
                   + Send
                   + Sync),
    ) -> Pin<Box<dyn Future<Output = Result<ProcessingResult, CoreError>> + Send + 'a>> {
        Box::pin(async move {
            // Ollama's tool-use support varies by model.
            // For now, send a single prompt and parse the JSON response.
            let messages = vec![
                ChatMessage {
                    role: "system".into(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".into(),
                    content: user_prompt.to_string(),
                },
            ];

            let request = ChatRequest {
                model: self.model.clone(),
                messages,
                tools: None,
                stream: false,
            };

            let response = self
                .client
                .post(format!("{}/api/chat", self.base_url))
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
                .await
                .map_err(|e| CoreError::AiProvider {
                    msg: format!("Ollama request failed: {e}"),
                })?;

            let body = response
                .json::<ChatResponse>()
                .await
                .map_err(|e| CoreError::AiProvider {
                    msg: format!("Failed to parse Ollama response: {e}"),
                })?;

            parse_processing_result(&body.message.content)
        })
    }
}

fn parse_processing_result(text: &str) -> Result<ProcessingResult, CoreError> {
    let json_str = if let Some(start_idx) = text.find("```json") {
        let start = start_idx + 7;
        let end = text[start..]
            .find("```")
            .map(|e| start + e)
            .unwrap_or(text.len());
        text[start..end].trim()
    } else {
        text.trim()
    };

    match serde_json::from_str::<serde_json::Value>(json_str) {
        Ok(parsed) => Ok(ProcessingResult {
            source_title: parsed["sourceTitle"]
                .as_str()
                .unwrap_or("Untitled")
                .to_string(),
            impact: match parsed["impact"].as_str().unwrap_or("standard") {
                "bookmark" => ResolvedImpact::Bookmark,
                "deep" => ResolvedImpact::Deep,
                _ => ResolvedImpact::Standard,
            },
            files_created: parsed["filesCreated"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            files_modified: parsed["filesModified"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            summary: parsed["summary"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        }),
        Err(_) => Ok(ProcessingResult {
            source_title: "Untitled".into(),
            impact: ResolvedImpact::Standard,
            files_created: vec![],
            files_modified: vec![],
            summary: text.chars().take(200).collect(),
        }),
    }
}
