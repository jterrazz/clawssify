//! Anthropic Claude API client — port of `server/src/services/ai/anthropic.ts`.

use crate::ai::provider::AiProvider;
use crate::models::*;
use crate::CoreError;
use serde::{Serialize, Deserialize};
use std::future::Future;
use std::pin::Pin;

const MAX_ITERATIONS: usize = 25;

pub struct AnthropicProvider {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            client: reqwest::Client::new(),
        }
    }
}

// --- Anthropic API types ---

#[derive(Serialize)]
struct CreateMessageRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Message>,
    tools: Vec<AnthropicTool>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Message {
    role: String,
    content: serde_json::Value,
}

#[derive(Serialize)]
struct AnthropicTool {
    name: String,
    description: String,
    input_schema: serde_json::Value,
}

#[derive(Deserialize)]
struct CreateMessageResponse {
    content: Vec<ContentBlock>,
    stop_reason: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
}

impl AiProvider for AnthropicProvider {
    fn process<'a>(
        &'a self,
        system_prompt: &'a str,
        user_prompt: &'a str,
        tools: &'a [ToolDefinition],
        execute_tool: &'a (dyn Fn(ToolCall) -> Pin<Box<dyn Future<Output = ToolResult> + Send>>
                  + Send
                  + Sync),
    ) -> Pin<Box<dyn Future<Output = Result<ProcessingResult, CoreError>> + Send + 'a>> {
        Box::pin(async move {
            let anthropic_tools: Vec<AnthropicTool> = tools
                .iter()
                .map(|t| AnthropicTool {
                    name: t.name.clone(),
                    description: t.description.clone(),
                    input_schema: serde_json::json!({
                        "type": "object",
                        "properties": t.parameters,
                        "required": t.parameters.as_object()
                            .map(|o| o.keys().cloned().collect::<Vec<_>>())
                            .unwrap_or_default(),
                    }),
                })
                .collect();

            let mut messages = vec![Message {
                role: "user".into(),
                content: serde_json::Value::String(user_prompt.to_string()),
            }];

            for _ in 0..MAX_ITERATIONS {
                let request = CreateMessageRequest {
                    model: self.model.clone(),
                    max_tokens: 8192,
                    system: system_prompt.to_string(),
                    messages: messages.clone(),
                    tools: anthropic_tools.clone(),
                };

                let response = self
                    .client
                    .post("https://api.anthropic.com/v1/messages")
                    .header("x-api-key", &self.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .json(&request)
                    .send()
                    .await?;

                let body = response
                    .json::<CreateMessageResponse>()
                    .await
                    .map_err(|e| CoreError::AiProvider {
                        msg: format!("Failed to parse Anthropic response: {e}"),
                    })?;

                let tool_use_blocks: Vec<&ContentBlock> = body
                    .content
                    .iter()
                    .filter(|b| matches!(b, ContentBlock::ToolUse { .. }))
                    .collect();

                let text_blocks: Vec<&ContentBlock> = body
                    .content
                    .iter()
                    .filter(|b| matches!(b, ContentBlock::Text { .. }))
                    .collect();

                if body.stop_reason.as_deref() == Some("end_turn") && tool_use_blocks.is_empty() {
                    let final_text: String = text_blocks
                        .iter()
                        .filter_map(|b| match b {
                            ContentBlock::Text { text } => Some(text.as_str()),
                            _ => None,
                        })
                        .collect();
                    return parse_processing_result(&final_text);
                }

                if !tool_use_blocks.is_empty() {
                    messages.push(Message {
                        role: "assistant".into(),
                        content: serde_json::to_value(&body.content)
                            .unwrap_or(serde_json::Value::Null),
                    });

                    let mut tool_results = Vec::new();
                    for block in &tool_use_blocks {
                        if let ContentBlock::ToolUse { id, name, input } = block {
                            let args = input
                                .as_object()
                                .cloned()
                                .unwrap_or_default()
                                .into_iter()
                                .collect();
                            let result = execute_tool(ToolCall {
                                name: name.clone(),
                                arguments: serde_json::Value::Object(args),
                            })
                            .await;
                            tool_results.push(serde_json::json!({
                                "type": "tool_result",
                                "tool_use_id": id,
                                "content": result.result,
                                "is_error": result.is_error,
                            }));
                        }
                    }

                    messages.push(Message {
                        role: "user".into(),
                        content: serde_json::Value::Array(tool_results),
                    });
                }
            }

            Err(CoreError::AiProvider {
                msg: format!("Exceeded maximum iterations ({MAX_ITERATIONS})"),
            })
        })
    }
}

fn parse_processing_result(text: &str) -> Result<ProcessingResult, CoreError> {
    // Try to extract JSON from markdown code block
    let json_str = if let Some(caps) = text.find("```json") {
        let start = caps + 7;
        let end = text[start..].find("```").map(|e| start + e).unwrap_or(text.len());
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

// Make AnthropicTool cloneable for the loop
impl Clone for AnthropicTool {
    fn clone(&self) -> Self {
        Self {
            name: self.name.clone(),
            description: self.description.clone(),
            input_schema: self.input_schema.clone(),
        }
    }
}
