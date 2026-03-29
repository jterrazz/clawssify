//! Markdown parsing with pulldown-cmark.

use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};

/// Parsed markdown document.
#[derive(Debug, Clone)]
pub struct MarkdownDocument {
    pub frontmatter: Option<Frontmatter>,
    pub sections: Vec<Section>,
    pub raw: String,
}

/// YAML frontmatter extracted from `---` delimiters.
#[derive(Debug, Clone)]
pub struct Frontmatter {
    pub raw: String,
    pub fields: Vec<(String, String)>,
}

/// A section of markdown content headed by a heading.
#[derive(Debug, Clone)]
pub struct Section {
    pub level: u8,
    pub title: String,
    pub content: String,
}

/// Parse a markdown string into structured sections.
pub fn parse_markdown(input: &str) -> MarkdownDocument {
    let (frontmatter, body) = extract_frontmatter(input);

    let options = Options::all();
    let parser = Parser::new_ext(body, options);

    let mut sections = Vec::new();
    let mut current_heading: Option<(u8, String)> = None;
    let mut current_content = String::new();
    let mut in_heading = false;
    let mut heading_text = String::new();

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                // Save previous section
                if let Some((lvl, title)) = current_heading.take() {
                    sections.push(Section {
                        level: lvl,
                        title,
                        content: current_content.trim().to_string(),
                    });
                    current_content.clear();
                }
                in_heading = true;
                heading_text.clear();
                current_heading = Some((level as u8, String::new()));
            }
            Event::End(TagEnd::Heading(_)) => {
                in_heading = false;
                if let Some((_, ref mut title)) = current_heading {
                    *title = heading_text.trim().to_string();
                }
            }
            Event::Text(text) => {
                if in_heading {
                    heading_text.push_str(&text);
                } else {
                    current_content.push_str(&text);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if in_heading {
                    heading_text.push(' ');
                } else {
                    current_content.push('\n');
                }
            }
            Event::Code(code) => {
                if in_heading {
                    heading_text.push_str(&code);
                } else {
                    current_content.push('`');
                    current_content.push_str(&code);
                    current_content.push('`');
                }
            }
            _ => {}
        }
    }

    // Push final section
    if let Some((lvl, title)) = current_heading {
        sections.push(Section {
            level: lvl,
            title,
            content: current_content.trim().to_string(),
        });
    } else if !current_content.trim().is_empty() {
        sections.push(Section {
            level: 0,
            title: String::new(),
            content: current_content.trim().to_string(),
        });
    }

    MarkdownDocument {
        frontmatter,
        sections,
        raw: input.to_string(),
    }
}

fn extract_frontmatter(input: &str) -> (Option<Frontmatter>, &str) {
    if !input.starts_with("---") {
        return (None, input);
    }

    let rest = &input[3..];
    if let Some(end_idx) = rest.find("\n---") {
        let fm_raw = rest[..end_idx].trim();
        let body_start = 3 + end_idx + 4; // skip past closing ---\n
        let body = if body_start < input.len() {
            &input[body_start..]
        } else {
            ""
        };

        let fields: Vec<(String, String)> = fm_raw
            .lines()
            .filter_map(|line| {
                let mut parts = line.splitn(2, ':');
                let key = parts.next()?.trim().to_string();
                let value = parts.next()?.trim().to_string();
                if key.is_empty() {
                    None
                } else {
                    Some((key, value))
                }
            })
            .collect();

        (
            Some(Frontmatter {
                raw: fm_raw.to_string(),
                fields,
            }),
            body,
        )
    } else {
        (None, input)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_markdown() {
        let input = "# Hello\n\nWorld\n\n## Section 2\n\nContent here";
        let doc = parse_markdown(input);
        assert_eq!(doc.sections.len(), 2);
        assert_eq!(doc.sections[0].title, "Hello");
        assert_eq!(doc.sections[1].title, "Section 2");
    }

    #[test]
    fn test_parse_frontmatter() {
        let input = "---\ntitle: Test\ndate: 2024-01-01\n---\n# Heading\n\nBody";
        let doc = parse_markdown(input);
        assert!(doc.frontmatter.is_some());
        let fm = doc.frontmatter.unwrap();
        assert_eq!(fm.fields.len(), 2);
        assert_eq!(fm.fields[0], ("title".to_string(), "Test".to_string()));
    }
}
