//! Brain storage — port of `server/src/services/storage/brain.ts`.

use crate::models::BrainContext;
use crate::CoreError;
use std::path::{Path, PathBuf};
use tokio::fs;

pub struct BrainStorage {
    data_dir: PathBuf,
}

impl BrainStorage {
    pub fn new(data_dir: &str) -> Self {
        Self {
            data_dir: PathBuf::from(data_dir),
        }
    }

    pub async fn load_context(&self) -> Result<BrainContext, CoreError> {
        let (system, structure, decisions) = tokio::try_join!(
            self.read_brain_file("SYSTEM.md"),
            self.read_brain_file("STRUCTURE.md"),
            self.read_brain_file("DECISIONS.md"),
        )?;

        let knowledge_tree = self.scan_knowledge_tree(None).await?;

        Ok(BrainContext {
            system,
            structure,
            decisions: last_lines(&decisions, 50),
            knowledge_tree,
        })
    }

    pub async fn log_decision(&self, entry: &str) -> Result<(), CoreError> {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let line = format!("\n## {timestamp}\n{entry}\n");
        let path = self.data_dir.join(".brain").join("DECISIONS.md");
        let mut content = fs::read_to_string(&path).await.unwrap_or_default();
        content.push_str(&line);
        fs::write(&path, content).await?;
        Ok(())
    }

    pub async fn add_pending(&self, entry: &str) -> Result<(), CoreError> {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let line = format!("\n## {timestamp}\n{entry}\n");
        let path = self.data_dir.join(".brain").join("PENDING.md");
        let mut content = fs::read_to_string(&path).await.unwrap_or_default();
        content.push_str(&line);
        fs::write(&path, content).await?;
        Ok(())
    }

    async fn read_brain_file(&self, filename: &str) -> Result<String, CoreError> {
        let path = self.data_dir.join(".brain").join(filename);
        match fs::read_to_string(&path).await {
            Ok(content) => Ok(content),
            Err(_) => Ok(String::new()),
        }
    }

    async fn scan_knowledge_tree(&self, dir: Option<&Path>) -> Result<Vec<String>, CoreError> {
        let base_dir = match dir {
            Some(d) => d.to_path_buf(),
            None => self.data_dir.join("knowledge"),
        };
        let knowledge_root = self.data_dir.join("knowledge");
        let mut results = Vec::new();

        let Ok(mut entries) = fs::read_dir(&base_dir).await else {
            return Ok(results);
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Ok(ft) = entry.file_type().await {
                if ft.is_dir() {
                    let nested = Box::pin(self.scan_knowledge_tree(Some(&path))).await?;
                    results.extend(nested);
                } else if path.extension().map_or(false, |e| e == "md") {
                    if let Ok(rel) = path.strip_prefix(&knowledge_root) {
                        results.push(rel.to_string_lossy().to_string());
                    }
                }
            }
        }

        Ok(results)
    }
}

fn last_lines(content: &str, n: usize) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}
