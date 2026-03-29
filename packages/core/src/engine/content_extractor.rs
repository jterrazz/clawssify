//! URL readability + text extraction — port of `server/src/services/content-extractor.ts`.

use crate::models::{ContentType, ExtractedContent};
use crate::CoreError;

/// Extract content from the given input based on content type.
pub async fn extract_content(
    content_type: &ContentType,
    content: &str,
) -> Result<ExtractedContent, CoreError> {
    match content_type {
        ContentType::Url => extract_from_url(content).await,
        ContentType::Tweet => {
            if is_tweet_url(content) {
                extract_from_url(content.trim()).await
            } else {
                Ok(extract_from_text(content))
            }
        }
        ContentType::Text | ContentType::Note | ContentType::Conversation => {
            Ok(extract_from_text(content))
        }
    }
}

fn is_tweet_url(content: &str) -> bool {
    let trimmed = content.trim();
    trimmed.starts_with("http")
        && (trimmed.contains("twitter.com") || trimmed.contains("x.com"))
}

fn generate_title_from_text(text: &str) -> String {
    let first_line = text.lines().next().unwrap_or("").trim();
    if first_line.len() <= 60 {
        first_line.to_string()
    } else {
        format!("{}...", &first_line[..60])
    }
}

fn extract_from_text(content: &str) -> ExtractedContent {
    ExtractedContent {
        title: generate_title_from_text(content),
        text: content.to_string(),
        url: None,
    }
}

async fn extract_from_url(url: &str) -> Result<ExtractedContent, CoreError> {
    let trimmed_url = url.trim();

    let client = reqwest::Client::builder()
        .user_agent("Clawssify/0.1 (Knowledge Base Bot)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| CoreError::Network {
            msg: e.to_string(),
        })?;

    let response = client
        .get(trimmed_url)
        .send()
        .await
        .map_err(|e| CoreError::ContentExtraction {
            msg: e.to_string(),
        })?;

    let html = response
        .text()
        .await
        .map_err(|e| CoreError::ContentExtraction {
            msg: e.to_string(),
        })?;

    // Use scraper to extract readable text (similar to Readability)
    let document = scraper::Html::parse_document(&html);

    // Extract title
    let title_selector = scraper::Selector::parse("title").unwrap();
    let title = document
        .select(&title_selector)
        .next()
        .map(|el| el.text().collect::<String>())
        .unwrap_or_else(|| trimmed_url.to_string());

    // Extract body text — prefer <article>, fall back to <body>
    let text = extract_article_text(&document).unwrap_or_else(|| extract_body_text(&document));

    Ok(ExtractedContent {
        title,
        text,
        url: Some(trimmed_url.to_string()),
    })
}

fn extract_article_text(document: &scraper::Html) -> Option<String> {
    let article_selector = scraper::Selector::parse("article").ok()?;
    let article = document.select(&article_selector).next()?;
    let text: String = article.text().collect::<Vec<_>>().join(" ");
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn extract_body_text(document: &scraper::Html) -> String {
    let body_selector = scraper::Selector::parse("body").unwrap();
    document
        .select(&body_selector)
        .next()
        .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_from_text() {
        let result = extract_from_text("Hello world\nSecond line");
        assert_eq!(result.title, "Hello world");
        assert_eq!(result.text, "Hello world\nSecond line");
        assert!(result.url.is_none());
    }

    #[test]
    fn test_title_truncation() {
        let long_text = "A".repeat(100);
        let result = extract_from_text(&long_text);
        assert!(result.title.ends_with("..."));
        assert_eq!(result.title.len(), 63); // 60 + "..."
    }

    #[test]
    fn test_is_tweet_url() {
        assert!(is_tweet_url("https://twitter.com/user/status/123"));
        assert!(is_tweet_url("https://x.com/user/status/123"));
        assert!(!is_tweet_url("Just a tweet about something"));
    }
}
