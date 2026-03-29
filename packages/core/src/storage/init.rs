//! Data directory initialization — port of `server/src/services/storage/init.ts`.

use crate::CoreError;
use std::path::Path;
use tokio::fs;

const SYSTEM_SEED: &str = r#"# Clawssify Brain

You are an AI librarian managing a personal knowledge base.

## Preferences
- Language: English
- Style: Clear, concise, well-structured
- Merge threshold: Topics with 3+ overlapping concepts should be merged
"#;

const STRUCTURE_SEED: &str = r#"# Knowledge Structure

## Wiki Categories
Categories emerge organically as content is ingested.

## Naming Conventions
- Wiki pages: `wiki/{category}/{topic}.md`
- Posts: `posts/{date}_{slug}.md`
- Digest: `digest/{date}.md`
"#;

const DECISIONS_SEED: &str = "# Decisions Log\n";
const PENDING_SEED: &str = "# Pending Changes\n";

const INDEX_SEED: &str = r#"# Knowledge Base

Welcome to your Clawssify knowledge base.

## Sections
- [Wiki](/wiki/) — Topic pages that evolve over time
- [Posts](/posts/) — Articles from ingested sources
- [Digest](/digest/) — Daily changelog of changes
"#;

/// Initialize the data directory with seed files if they don't exist.
pub async fn initialize_data_directory(data_dir: &str) -> Result<(), CoreError> {
    let base = Path::new(data_dir);

    // Create directories
    let dirs = [
        ".brain",
        ".sources/analyses",
        "knowledge/wiki",
        "knowledge/posts",
        "knowledge/digest",
    ];
    for dir in &dirs {
        fs::create_dir_all(base.join(dir)).await?;
    }

    // Write seed files if missing
    write_if_missing(&base.join(".brain/SYSTEM.md"), SYSTEM_SEED).await?;
    write_if_missing(&base.join(".brain/STRUCTURE.md"), STRUCTURE_SEED).await?;
    write_if_missing(&base.join(".brain/DECISIONS.md"), DECISIONS_SEED).await?;
    write_if_missing(&base.join(".brain/PENDING.md"), PENDING_SEED).await?;
    write_if_missing(&base.join(".sources/sources.json"), "[]").await?;
    write_if_missing(&base.join("knowledge/index.md"), INDEX_SEED).await?;
    write_if_missing(
        &base.join("knowledge/wiki/index.md"),
        "# Wiki\n\nTopic pages organized by category.\n",
    )
    .await?;
    write_if_missing(
        &base.join("knowledge/posts/index.md"),
        "# Posts\n\nArticles from ingested sources.\n",
    )
    .await?;
    write_if_missing(
        &base.join("knowledge/digest/index.md"),
        "# Digest\n\nDaily changelog of knowledge base changes.\n",
    )
    .await?;

    Ok(())
}

async fn write_if_missing(path: &Path, content: &str) -> Result<(), CoreError> {
    if !path.exists() {
        fs::write(path, content).await?;
    }
    Ok(())
}
