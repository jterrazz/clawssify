//! Knowledge tree scanning and content serving.

use crate::models::{ContentEntry, KnowledgeTreeNode, SidebarItem};
use crate::CoreError;
use std::path::{Path, PathBuf};
use tokio::fs;

pub struct KnowledgeStorage {
    data_dir: PathBuf,
}

impl KnowledgeStorage {
    pub fn new(data_dir: &str) -> Self {
        Self {
            data_dir: PathBuf::from(data_dir),
        }
    }

    fn knowledge_dir(&self) -> PathBuf {
        self.data_dir.join("knowledge")
    }

    pub async fn get_tree(&self) -> Result<Vec<KnowledgeTreeNode>, CoreError> {
        let knowledge_dir = self.knowledge_dir();
        self.scan_dir(&knowledge_dir, &knowledge_dir).await
    }

    /// Get content by slug parts (e.g. ["wiki", "rust", "ownership"]).
    pub async fn get_content_by_slug(
        &self,
        slug: &[String],
    ) -> Result<Option<ContentEntry>, CoreError> {
        let knowledge_dir = self.knowledge_dir();

        // Try direct file: knowledge/<slug>.md
        let file_path = knowledge_dir.join(slug.join("/")).with_extension("md");
        if let Some(entry) = self.try_read_content(&file_path, slug).await? {
            return Ok(Some(entry));
        }

        // Try index file: knowledge/<slug>/index.md
        let index_path = knowledge_dir.join(slug.join("/")).join("index.md");
        self.try_read_content(&index_path, slug).await
    }

    /// List all content files in a section (e.g. "wiki", "posts", "digest").
    pub async fn get_content_list(&self, section: &str) -> Result<Vec<ContentEntry>, CoreError> {
        let mut files = Vec::new();
        let section_dir = self.knowledge_dir().join(section);
        self.scan_content_dir(&section_dir, &[section.to_string()], &mut files)
            .await;
        files.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        Ok(files)
    }

    /// Build a sidebar tree for navigation.
    pub async fn get_sidebar_tree(&self, section: &str) -> Result<Vec<SidebarItem>, CoreError> {
        let section_dir = self.knowledge_dir().join(section);
        let base_path = format!("/{section}");
        Ok(self.build_sidebar_items(&section_dir, &base_path).await)
    }

    /// Get all content across all sections.
    pub async fn get_all_content(&self) -> Result<Vec<ContentEntry>, CoreError> {
        let mut all = Vec::new();
        for section in &["wiki", "posts", "digest"] {
            let mut files = self.get_content_list(section).await?;
            all.append(&mut files);
        }
        Ok(all)
    }

    /// Read raw markdown content from a path relative to the knowledge dir.
    pub async fn load_page_raw(&self, rel_path: &str) -> Result<Option<String>, CoreError> {
        let full_path = self.knowledge_dir().join(rel_path);
        match fs::read_to_string(&full_path).await {
            Ok(content) => Ok(Some(content)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(CoreError::from(e)),
        }
    }

    async fn try_read_content(
        &self,
        file_path: &Path,
        slug: &[String],
    ) -> Result<Option<ContentEntry>, CoreError> {
        let raw = match fs::read_to_string(file_path).await {
            Ok(content) => content,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(CoreError::from(e)),
        };

        let stat = fs::metadata(file_path).await?;
        let last_modified = stat
            .modified()
            .ok()
            .and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| {
                        chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default()
                    })
            })
            .unwrap_or_default();

        let (frontmatter, content) = parse_frontmatter(&raw);
        let section = slug.first().map(|s| s.as_str()).unwrap_or("").to_string();
        let title = frontmatter
            .get("title")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                slug.last()
                    .map(|s| format_name(s))
                    .unwrap_or_default()
            });

        Ok(Some(ContentEntry {
            slug: slug.to_vec(),
            title,
            content,
            frontmatter,
            section,
            last_modified,
        }))
    }

    async fn scan_content_dir(
        &self,
        dir: &Path,
        slug_prefix: &[String],
        results: &mut Vec<ContentEntry>,
    ) {
        let Ok(mut entries) = fs::read_dir(dir).await else {
            return;
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name.starts_with('_') {
                continue;
            }

            let path = entry.path();
            if let Ok(ft) = entry.file_type().await {
                if ft.is_dir() {
                    let mut new_prefix = slug_prefix.to_vec();
                    new_prefix.push(name);
                    Box::pin(self.scan_content_dir(&path, &new_prefix, results)).await;
                } else if name.ends_with(".md") && name != "index.md" {
                    let basename = name.trim_end_matches(".md").to_string();
                    let mut slug = slug_prefix.to_vec();
                    slug.push(basename);

                    if let Ok(Some(entry)) = self.try_read_content(&path, &slug).await {
                        results.push(entry);
                    }
                }
            }
        }
    }

    async fn build_sidebar_items(&self, dir: &Path, base_path: &str) -> Vec<SidebarItem> {
        let mut items = Vec::new();

        let Ok(mut entries) = fs::read_dir(dir).await else {
            return items;
        };

        let mut dir_entries = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            dir_entries.push(entry);
        }
        dir_entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        for entry in dir_entries {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name.starts_with('_') {
                continue;
            }

            let path = entry.path();
            if let Ok(ft) = entry.file_type().await {
                if ft.is_dir() {
                    let children = Box::pin(
                        self.build_sidebar_items(&path, &format!("{base_path}/{name}")),
                    )
                    .await;
                    if !children.is_empty() {
                        items.push(SidebarItem {
                            title: name,
                            href: None,
                            children,
                        });
                    }
                } else if name.ends_with(".md") && name != "index.md" {
                    let basename = name.trim_end_matches(".md").to_string();
                    items.push(SidebarItem {
                        title: basename.clone(),
                        href: Some(format!("{base_path}/{basename}")),
                        children: vec![],
                    });
                }
            }
        }

        items
    }

    async fn scan_dir(
        &self,
        dir: &Path,
        root: &Path,
    ) -> Result<Vec<KnowledgeTreeNode>, CoreError> {
        let mut nodes = Vec::new();

        let Ok(mut entries) = fs::read_dir(dir).await else {
            return Ok(nodes);
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }

            let path = entry.path();
            let rel_path = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            if let Ok(ft) = entry.file_type().await {
                if ft.is_dir() {
                    let children = Box::pin(self.scan_dir(&path, root)).await?;
                    nodes.push(KnowledgeTreeNode {
                        path: rel_path,
                        title: name,
                        children,
                    });
                } else if name.ends_with(".md") {
                    let title = extract_title_from_file(&path).await.unwrap_or(name);
                    nodes.push(KnowledgeTreeNode {
                        path: rel_path,
                        title,
                        children: vec![],
                    });
                }
            }
        }

        nodes.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(nodes)
    }
}

/// Parse frontmatter from markdown content.
/// Returns (frontmatter as JSON value, content without frontmatter).
fn parse_frontmatter(raw: &str) -> (serde_json::Value, String) {
    if !raw.starts_with("---") {
        return (serde_json::Value::Object(Default::default()), raw.to_string());
    }

    let rest = &raw[3..];
    let Some(end) = rest.find("---") else {
        return (serde_json::Value::Object(Default::default()), raw.to_string());
    };

    let fm_str = &rest[..end];
    let content = rest[end + 3..].trim_start_matches('\n').to_string();

    // Simple YAML-like key: value parser
    let mut map = serde_json::Map::new();
    for line in fm_str.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
            map.insert(key, serde_json::Value::String(value));
        }
    }

    (serde_json::Value::Object(map), content)
}

/// Extract the title from a markdown file's frontmatter or first heading.
async fn extract_title_from_file(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).await.ok()?;

    // Try frontmatter title
    if content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let frontmatter = &content[3..3 + end];
            for line in frontmatter.lines() {
                let trimmed = line.trim();
                if let Some(title) = trimmed.strip_prefix("title:") {
                    return Some(title.trim().trim_matches('"').trim_matches('\'').to_string());
                }
            }
        }
    }

    // Try first # heading
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(heading) = trimmed.strip_prefix("# ") {
            return Some(heading.to_string());
        }
    }

    None
}

/// Format a slug segment into a display name.
pub fn format_name(name: &str) -> String {
    // Strip date prefix like "2024-01-01_"
    let name = if name.len() > 11 && name.chars().nth(4) == Some('-') && name.chars().nth(10) == Some('_') {
        &name[11..]
    } else {
        name
    };

    name.replace(['-', '_'], " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => {
                    let upper: String = c.to_uppercase().collect();
                    upper + chars.as_str()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter() {
        let raw = "---\ntitle: Hello World\ndate: 2024-01-01\n---\n# Content here";
        let (fm, content) = parse_frontmatter(raw);
        assert_eq!(fm.get("title").unwrap().as_str().unwrap(), "Hello World");
        assert_eq!(fm.get("date").unwrap().as_str().unwrap(), "2024-01-01");
        assert_eq!(content, "# Content here");
    }

    #[test]
    fn test_parse_frontmatter_no_frontmatter() {
        let raw = "# Just a heading\nSome content";
        let (fm, content) = parse_frontmatter(raw);
        assert!(fm.as_object().unwrap().is_empty());
        assert_eq!(content, raw);
    }

    #[test]
    fn test_format_name() {
        assert_eq!(format_name("hello-world"), "Hello World");
        assert_eq!(format_name("2024-01-01_my-post"), "My Post");
        assert_eq!(format_name("rust_ownership"), "Rust Ownership");
    }

    #[tokio::test]
    async fn test_get_content_by_slug() {
        let dir = tempfile::tempdir().unwrap();
        let knowledge = dir.path().join("knowledge").join("wiki");
        std::fs::create_dir_all(&knowledge).unwrap();
        std::fs::write(
            knowledge.join("test-page.md"),
            "---\ntitle: Test Page\n---\n# Hello\nContent here",
        )
        .unwrap();

        let storage = KnowledgeStorage::new(dir.path().to_str().unwrap());
        let result = storage
            .get_content_by_slug(&["wiki".into(), "test-page".into()])
            .await
            .unwrap();

        assert!(result.is_some());
        let entry = result.unwrap();
        assert_eq!(entry.title, "Test Page");
        assert_eq!(entry.section, "wiki");
        assert!(entry.content.contains("Content here"));
    }

    #[tokio::test]
    async fn test_get_content_list() {
        let dir = tempfile::tempdir().unwrap();
        let wiki_dir = dir.path().join("knowledge").join("wiki");
        std::fs::create_dir_all(&wiki_dir).unwrap();
        std::fs::write(
            wiki_dir.join("page-a.md"),
            "---\ntitle: Page A\n---\nContent A",
        )
        .unwrap();
        std::fs::write(
            wiki_dir.join("page-b.md"),
            "---\ntitle: Page B\n---\nContent B",
        )
        .unwrap();

        let storage = KnowledgeStorage::new(dir.path().to_str().unwrap());
        let list = storage.get_content_list("wiki").await.unwrap();

        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn test_get_sidebar_tree() {
        let dir = tempfile::tempdir().unwrap();
        let wiki_dir = dir.path().join("knowledge").join("wiki");
        let sub_dir = wiki_dir.join("rust");
        std::fs::create_dir_all(&sub_dir).unwrap();
        std::fs::write(wiki_dir.join("intro.md"), "# Intro").unwrap();
        std::fs::write(sub_dir.join("ownership.md"), "# Ownership").unwrap();

        let storage = KnowledgeStorage::new(dir.path().to_str().unwrap());
        let tree = storage.get_sidebar_tree("wiki").await.unwrap();

        assert!(!tree.is_empty());
    }

    #[tokio::test]
    async fn test_get_all_content() {
        let dir = tempfile::tempdir().unwrap();
        let wiki_dir = dir.path().join("knowledge").join("wiki");
        let posts_dir = dir.path().join("knowledge").join("posts");
        std::fs::create_dir_all(&wiki_dir).unwrap();
        std::fs::create_dir_all(&posts_dir).unwrap();
        std::fs::write(wiki_dir.join("page.md"), "---\ntitle: Wiki\n---\nW").unwrap();
        std::fs::write(posts_dir.join("post.md"), "---\ntitle: Post\n---\nP").unwrap();

        let storage = KnowledgeStorage::new(dir.path().to_str().unwrap());
        let all = storage.get_all_content().await.unwrap();

        assert_eq!(all.len(), 2);
    }
}
