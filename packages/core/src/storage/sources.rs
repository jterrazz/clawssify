//! Sources storage — port of `server/src/services/storage/sources.ts`.

use crate::models::{Source, SourceStatus};
use crate::storage::file_lock::with_file_lock;
use crate::CoreError;
use std::path::PathBuf;
use tokio::fs;

pub struct SourcesStorage {
    data_dir: PathBuf,
}

impl SourcesStorage {
    pub fn new(data_dir: &str) -> Self {
        Self {
            data_dir: PathBuf::from(data_dir),
        }
    }

    fn sources_path(&self) -> PathBuf {
        self.data_dir.join(".sources").join("sources.json")
    }

    pub async fn register_source(&self, source: &Source) -> Result<(), CoreError> {
        let path = self.sources_path();
        with_file_lock(&path, || async {
            let mut sources = self.read_sources().await?;
            sources.push(source.clone());
            let json = serde_json::to_string_pretty(&sources)?;
            fs::write(&path, json).await?;
            Ok(())
        })
        .await
    }

    pub async fn get_source(&self, id: &str) -> Result<Option<Source>, CoreError> {
        let sources = self.read_sources().await?;
        Ok(sources.into_iter().find(|s| s.id == id))
    }

    pub async fn get_all(&self) -> Result<Vec<Source>, CoreError> {
        self.read_sources().await
    }

    pub async fn update_source_status(
        &self,
        id: &str,
        status: SourceStatus,
    ) -> Result<(), CoreError> {
        let path = self.sources_path();
        with_file_lock(&path, || async {
            let mut sources = self.read_sources().await?;
            if let Some(source) = sources.iter_mut().find(|s| s.id == id) {
                source.status = status;
            }
            let json = serde_json::to_string_pretty(&sources)?;
            fs::write(&path, json).await?;
            Ok(())
        })
        .await
    }

    pub async fn write_analysis(&self, source_id: &str, content: &str) -> Result<String, CoreError> {
        let rel_path = format!(".sources/analyses/{source_id}.md");
        let full_path = self.data_dir.join(&rel_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&full_path, content).await?;
        Ok(rel_path)
    }

    async fn read_sources(&self) -> Result<Vec<Source>, CoreError> {
        let path = self.sources_path();
        match fs::read_to_string(&path).await {
            Ok(raw) => {
                let sources: Vec<Source> = serde_json::from_str(&raw)?;
                Ok(sources)
            }
            Err(_) => Ok(vec![]),
        }
    }
}
