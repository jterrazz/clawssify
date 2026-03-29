//! Tool definitions and executor — port of `server/src/services/ai/tools.ts`.

use crate::models::{ToolCall, ToolDefinition, ToolResult};
use crate::CoreError;
use serde_json::json;
use std::path::{Path, PathBuf};
use tokio::fs;

/// Return the tool definitions exposed to the AI agent.
pub fn get_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "read_file".into(),
            description: "Read the contents of a file in the knowledge base.".into(),
            parameters: json!({
                "path": { "type": "string", "description": "Relative path from the data directory" }
            }),
        },
        ToolDefinition {
            name: "write_file".into(),
            description: "Create or overwrite a file. Parent directories are created automatically.".into(),
            parameters: json!({
                "path": { "type": "string", "description": "Relative path from the data directory" },
                "content": { "type": "string", "description": "File content to write" }
            }),
        },
        ToolDefinition {
            name: "edit_file".into(),
            description: "Find and replace text within a file. The old_text must match exactly.".into(),
            parameters: json!({
                "path": { "type": "string", "description": "Relative path from the data directory" },
                "old_text": { "type": "string", "description": "Text to find (exact match)" },
                "new_text": { "type": "string", "description": "Text to replace with" }
            }),
        },
        ToolDefinition {
            name: "list_directory".into(),
            description: "List files and subdirectories in a directory.".into(),
            parameters: json!({
                "path": { "type": "string", "description": "Relative path from the data directory" }
            }),
        },
        ToolDefinition {
            name: "grep_files".into(),
            description: "Search for a pattern in files recursively. Returns matching lines with file paths.".into(),
            parameters: json!({
                "pattern": { "type": "string", "description": "Search pattern (literal string)" },
                "path": { "type": "string", "description": "Directory to search in (relative). Defaults to knowledge/" }
            }),
        },
        ToolDefinition {
            name: "append_file".into(),
            description: "Append content to the end of a file. Useful for digest and decision logs.".into(),
            parameters: json!({
                "path": { "type": "string", "description": "Relative path from the data directory" },
                "content": { "type": "string", "description": "Content to append" }
            }),
        },
    ]
}

/// Validate that a user-provided path stays inside the data directory.
fn safe_path(data_dir: &str, user_path: &str) -> Result<PathBuf, CoreError> {
    let base = PathBuf::from(data_dir).canonicalize().unwrap_or_else(|_| PathBuf::from(data_dir));
    let resolved = base.join(user_path);
    // Normalize by resolving .. components
    let normalized = normalize_path(&resolved);
    if !normalized.starts_with(&base) {
        return Err(CoreError::Storage {
            msg: format!("Path escapes data directory: {user_path}"),
        });
    }
    Ok(normalized)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for comp in path.components() {
        match comp {
            std::path::Component::ParentDir => {
                components.pop();
            }
            std::path::Component::CurDir => {}
            _ => components.push(comp),
        }
    }
    components.iter().collect()
}

/// Create a tool executor closure bound to a data directory.
pub fn create_tool_executor(
    data_dir: &str,
) -> impl Fn(ToolCall) -> std::pin::Pin<Box<dyn std::future::Future<Output = ToolResult> + Send>>
       + Send
       + Sync {
    let data_dir = data_dir.to_string();
    move |call: ToolCall| {
        let dir = data_dir.clone();
        Box::pin(async move { execute_tool(&dir, call).await })
    }
}

async fn execute_tool(data_dir: &str, call: ToolCall) -> ToolResult {
    match execute_tool_inner(data_dir, &call).await {
        Ok(result) => result,
        Err(e) => ToolResult {
            name: call.name,
            result: format!("Error: {e}"),
            is_error: true,
        },
    }
}

async fn execute_tool_inner(data_dir: &str, call: &ToolCall) -> Result<ToolResult, CoreError> {
    match call.name.as_str() {
        "read_file" => {
            let path = call.arguments["path"].as_str().unwrap_or("");
            let file_path = safe_path(data_dir, path)?;
            let content = fs::read_to_string(&file_path).await?;
            Ok(ToolResult {
                name: call.name.clone(),
                result: content,
                is_error: false,
            })
        }
        "write_file" => {
            let path = call.arguments["path"].as_str().unwrap_or("");
            let content = call.arguments["content"].as_str().unwrap_or("");
            let file_path = safe_path(data_dir, path)?;
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).await?;
            }
            fs::write(&file_path, content).await?;
            Ok(ToolResult {
                name: call.name.clone(),
                result: format!("File written: {path}"),
                is_error: false,
            })
        }
        "edit_file" => {
            let path = call.arguments["path"].as_str().unwrap_or("");
            let old_text = call.arguments["old_text"].as_str().unwrap_or("");
            let new_text = call.arguments["new_text"].as_str().unwrap_or("");
            let file_path = safe_path(data_dir, path)?;
            let existing = fs::read_to_string(&file_path).await?;
            if !existing.contains(old_text) {
                return Ok(ToolResult {
                    name: call.name.clone(),
                    result: "Error: old_text not found in file".into(),
                    is_error: true,
                });
            }
            fs::write(&file_path, existing.replacen(old_text, new_text, 1)).await?;
            Ok(ToolResult {
                name: call.name.clone(),
                result: format!("File edited: {path}"),
                is_error: false,
            })
        }
        "list_directory" => {
            let path = call.arguments["path"].as_str().unwrap_or("");
            let dir_path = safe_path(data_dir, path)?;
            let mut entries = fs::read_dir(&dir_path).await?;
            let mut listing = Vec::new();
            while let Some(entry) = entries.next_entry().await? {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_dir = entry.file_type().await?.is_dir();
                listing.push(if is_dir {
                    format!("[dir] {name}")
                } else {
                    name
                });
            }
            Ok(ToolResult {
                name: call.name.clone(),
                result: if listing.is_empty() {
                    "(empty directory)".into()
                } else {
                    listing.join("\n")
                },
                is_error: false,
            })
        }
        "grep_files" => {
            let pattern = call.arguments["pattern"].as_str().unwrap_or("");
            let search_path = call.arguments["path"]
                .as_str()
                .unwrap_or("knowledge");
            let dir_path = safe_path(data_dir, search_path)?;
            let base = PathBuf::from(data_dir);
            let results = grep_recursive(&dir_path, pattern, &base).await;
            Ok(ToolResult {
                name: call.name.clone(),
                result: if results.is_empty() {
                    "No matches found".into()
                } else {
                    results.join("\n")
                },
                is_error: false,
            })
        }
        "append_file" => {
            let path = call.arguments["path"].as_str().unwrap_or("");
            let content = call.arguments["content"].as_str().unwrap_or("");
            let file_path = safe_path(data_dir, path)?;
            let mut existing = fs::read_to_string(&file_path).await.unwrap_or_default();
            existing.push_str(content);
            fs::write(&file_path, existing).await?;
            Ok(ToolResult {
                name: call.name.clone(),
                result: format!("Content appended to: {path}"),
                is_error: false,
            })
        }
        _ => Ok(ToolResult {
            name: call.name.clone(),
            result: format!("Unknown tool: {}", call.name),
            is_error: true,
        }),
    }
}

async fn grep_recursive(dir: &Path, pattern: &str, base: &Path) -> Vec<String> {
    let mut results = Vec::new();
    let Ok(mut entries) = fs::read_dir(dir).await else {
        return results;
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if let Ok(ft) = entry.file_type().await {
            if ft.is_dir() {
                let nested = Box::pin(grep_recursive(&path, pattern, base)).await;
                results.extend(nested);
            } else if name.ends_with(".md") || name.ends_with(".json") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    for (i, line) in content.lines().enumerate() {
                        if line.contains(pattern) {
                            let rel = path
                                .strip_prefix(base)
                                .unwrap_or(&path)
                                .to_string_lossy();
                            results.push(format!("{rel}:{}:{line}", i + 1));
                        }
                    }
                }
            }
        }
        if results.len() >= 100 {
            break;
        }
    }
    results
}
