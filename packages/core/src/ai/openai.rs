//! OpenAI API client — port of `server/src/services/ai/openai.ts`.

use crate::ai::provider::AiProvider;
use crate::models::*;
use crate::CoreError;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::pin::Pin;

const MAX_ITERATIONS: usize = 25;

pub struct OpenAiProvider {
    api_key: String,
    model: String,
    base_url: String,
    client: reqwest::Client,
}

impl OpenAiProvider {
    pub fn new(api_key: String, model: String, base_url: Option<String>) -> Self {
        Self {
            api_key,
            model,
            base_url: base_url.unwrap_or_else(|| "https://api.openai.com/v1".into()),
            client: reqwest::Client::new(),
        }
    }
}

// --- OpenAI API types ---

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    tools: Vec<OpenAiTool>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OpenAiToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

#[derive(Serialize, Clone)]
struct OpenAiTool {
    #[serde(rename = "type")]
    tool_type: String,
    function: OpenAiFunction,
}

#[derive(Serialize, Clone)]
struct OpenAiFunction {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
struct OpenAiToolCall {
    id: String,
    #[serde(rename = "type")]
    call_type: String,
    function: OpenAiFunctionCall,
}

#[derive(Serialize, Deserialize, Clone)]
struct OpenAiFunctionCall {
    name: String,
    arguments: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

impl AiProvider for OpenAiProvider {
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
            let openai_tools: Vec<OpenAiTool> = tools
                .iter()
                .map(|t| OpenAiTool {
                    tool_type: "function".into(),
                    function: OpenAiFunction {
                        name: t.name.clone(),
                        description: t.description.clone(),
                        parameters: serde_json::json!({
                            "type": "object",
                            "properties": t.parameters,
                            "required": t.parameters.as_object()
                                .map(|o| o.keys().cloned().collect::<Vec<_>>())
                                .unwrap_or_default(),
                        }),
                    },
                })
                .collect();

            let mut messages = vec![
                ChatMessage {
                    role: "system".into(),
                    content: Some(system_prompt.to_string()),
                    tool_calls: None,
                    tool_call_id: None,
                },
                ChatMessage {
                    role: "user".into(),
                    content: Some(user_prompt.to_string()),
                    tool_calls: None,
                    tool_call_id: None,
                },
            ];

            for _ in 0..MAX_ITERATIONS {
                let request = ChatCompletionRequest {
                    model: self.model.clone(),
                    messages: messages.clone(),
                    tools: openai_tools.clone(),
                };

                let response = self
                    .client
                    .post(format!("{}/chat/completions", self.base_url))
                    .header("Authorization", format!("Bearer {}", self.api_key))
                    .header("Content-Type", "application/json")
                    .json(&request)
                    .send()
                    .await?;

                let body = response
                    .json::<ChatCompletionResponse>()
                    .await
                    .map_err(|e| CoreError::AiProvider {
                        msg: format!("Failed to parse OpenAI response: {e}"),
                    })?;

                let choice = body.choices.into_iter().next().ok_or(CoreError::AiProvider {
                    msg: "No response from OpenAI".into(),
                })?;

                let message = choice.message;

                if message.tool_calls.is_none() || message.tool_calls.as_ref().map_or(true, |tc| tc.is_empty()) {
                    return parse_processing_result(message.content.as_deref().unwrap_or(""));
                }

                messages.push(message.clone());

                if let Some(tool_calls) = &message.tool_calls {
                    for tc in tool_calls {
                        let args: serde_json::Value =
                            serde_json::from_str(&tc.function.arguments).unwrap_or_default();
                        let result = execute_tool(ToolCall {
                            name: tc.function.name.clone(),
                            arguments: args,
                        })
                        .await;
                        messages.push(ChatMessage {
                            role: "tool".into(),
                            content: Some(result.result),
                            tool_calls: None,
                            tool_call_id: Some(tc.id.clone()),
                        });
                    }
                }
            }

            Err(CoreError::AiProvider {
                msg: format!("Exceeded maximum iterations ({MAX_ITERATIONS})"),
            })
        })
    }
}

fn parse_processing_result(text: &str) -> Result<ProcessingResult, CoreError> {
    let json_str = if let Some(start_idx) = text.find("```json") {
        let start = start_idx + 7;
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
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            files_modified: parsed["filesModified"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            summary: parsed["summary"].as_str().unwrap_or("").to_string(),
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
