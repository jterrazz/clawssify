//! Full-text search using tantivy.

use crate::CoreError;
use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{Index, IndexWriter, ReloadPolicy};
use tokio::fs;

/// Search the knowledge base for matching documents.
pub async fn search_knowledge(data_dir: &str, query: &str) -> Result<Vec<String>, CoreError> {
    let knowledge_dir = Path::new(data_dir).join("knowledge");

    // Build schema
    let mut schema_builder = Schema::builder();
    let path_field = schema_builder.add_text_field("path", STRING | STORED);
    let title_field = schema_builder.add_text_field("title", TEXT | STORED);
    let body_field = schema_builder.add_text_field("body", TEXT);
    let schema = schema_builder.build();

    // Create in-memory index
    let index = Index::create_in_ram(schema.clone());
    let mut index_writer: IndexWriter = index
        .writer(15_000_000)
        .map_err(|e| CoreError::Search { msg: e.to_string() })?;

    // Index all markdown files
    index_markdown_files(&knowledge_dir, &knowledge_dir, &mut index_writer, path_field, title_field, body_field)
        .await?;

    index_writer
        .commit()
        .map_err(|e| CoreError::Search { msg: e.to_string() })?;

    // Search
    let reader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::Manual)
        .try_into()
        .map_err(|e: tantivy::TantivyError| CoreError::Search { msg: e.to_string() })?;

    let searcher = reader.searcher();
    let query_parser = QueryParser::for_index(&index, vec![title_field, body_field]);
    let parsed_query = query_parser
        .parse_query(query)
        .map_err(|e| CoreError::Search { msg: e.to_string() })?;

    let top_docs = searcher
        .search(&parsed_query, &TopDocs::with_limit(20))
        .map_err(|e| CoreError::Search { msg: e.to_string() })?;

    let mut results = Vec::new();
    for (_score, doc_address) in top_docs {
        let doc: TantivyDocument = searcher
            .doc(doc_address)
            .map_err(|e| CoreError::Search { msg: e.to_string() })?;
        if let Some(path_value) = doc.get_first(path_field) {
            if let Some(path_str) = path_value.as_str() {
                results.push(path_str.to_string());
            }
        }
    }

    Ok(results)
}

async fn index_markdown_files(
    dir: &Path,
    root: &Path,
    writer: &mut IndexWriter,
    path_field: Field,
    title_field: Field,
    body_field: Field,
) -> Result<(), CoreError> {
    let Ok(mut entries) = fs::read_dir(dir).await else {
        return Ok(());
    };

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        if let Ok(ft) = entry.file_type().await {
            if ft.is_dir() {
                Box::pin(index_markdown_files(
                    &path,
                    root,
                    writer,
                    path_field,
                    title_field,
                    body_field,
                ))
                .await?;
            } else if name.ends_with(".md") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    let rel_path = path
                        .strip_prefix(root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string();

                    let title = extract_title(&content).unwrap_or_else(|| name.clone());

                    let mut doc = TantivyDocument::new();
                    doc.add_text(path_field, &rel_path);
                    doc.add_text(title_field, &title);
                    doc.add_text(body_field, &content);
                    writer
                        .add_document(doc)
                        .map_err(|e| CoreError::Search { msg: e.to_string() })?;
                }
            }
        }
    }

    Ok(())
}

fn extract_title(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(heading) = trimmed.strip_prefix("# ") {
            return Some(heading.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let knowledge_dir = dir.path().join("knowledge");
        fs::create_dir_all(&knowledge_dir).await.unwrap();

        let results = search_knowledge(dir.path().to_str().unwrap(), "test").await;
        assert!(results.is_ok());
        assert!(results.unwrap().is_empty());
    }
}
