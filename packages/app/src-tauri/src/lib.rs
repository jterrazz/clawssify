use clawssify_core::{
    config::EngineConfig,
    create_engine,
    models::{
        AiProviderType, ContentEntry, IngestPayload, KnowledgeTreeNode, ProcessingResult,
        SidebarItem, Source,
    },
    storage::knowledge::KnowledgeStorage,
    ClawssifyEngine,
};
use std::sync::Arc;
use tauri::State;

struct AppState {
    engine: Arc<ClawssifyEngine>,
    data_dir: String,
}

#[tauri::command]
fn get_knowledge_tree(state: State<AppState>) -> Result<Vec<KnowledgeTreeNode>, String> {
    state
        .engine
        .get_knowledge_tree()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sources(state: State<AppState>) -> Result<Vec<Source>, String> {
    state.engine.get_sources().map_err(|e| e.to_string())
}

#[tauri::command]
fn search(state: State<AppState>, query: String) -> Result<Vec<String>, String> {
    state.engine.search(query).map_err(|e| e.to_string())
}

#[tauri::command]
fn ingest(state: State<AppState>, payload: IngestPayload) -> Result<ProcessingResult, String> {
    state.engine.ingest(payload).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_content_by_slug(
    state: State<'_, AppState>,
    slug: Vec<String>,
) -> Result<Option<ContentEntry>, String> {
    let storage = KnowledgeStorage::new(&state.data_dir);
    storage
        .get_content_by_slug(&slug)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_content_list(
    state: State<'_, AppState>,
    section: String,
) -> Result<Vec<ContentEntry>, String> {
    let storage = KnowledgeStorage::new(&state.data_dir);
    storage
        .get_content_list(&section)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_sidebar_tree(
    state: State<'_, AppState>,
    section: String,
) -> Result<Vec<SidebarItem>, String> {
    let storage = KnowledgeStorage::new(&state.data_dir);
    storage
        .get_sidebar_tree(&section)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_content(
    state: State<'_, AppState>,
) -> Result<Vec<ContentEntry>, String> {
    let storage = KnowledgeStorage::new(&state.data_dir);
    storage.get_all_content().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_page(
    state: State<'_, AppState>,
    path: String,
) -> Result<Option<String>, String> {
    let storage = KnowledgeStorage::new(&state.data_dir);
    storage
        .load_page_raw(&path)
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = std::env::var("CLAWSSIFY_DATA_DIR").unwrap_or_else(|_| {
        let home = dirs_next::home_dir().unwrap_or_default();
        home.join(".clawssify/data")
            .to_string_lossy()
            .to_string()
    });

    let config = EngineConfig {
        data_dir: data_dir.clone(),
        ai_provider: AiProviderType::Ollama,
        ai_api_key: std::env::var("AI_API_KEY").ok(),
        ai_base_url: std::env::var("AI_BASE_URL").ok(),
        ai_model: std::env::var("AI_MODEL").ok(),
    };

    let engine = create_engine(config).expect("Failed to create engine");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            engine,
            data_dir,
        })
        .invoke_handler(tauri::generate_handler![
            get_knowledge_tree,
            get_sources,
            search,
            ingest,
            get_content_by_slug,
            get_content_list,
            get_sidebar_tree,
            get_all_content,
            load_page,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                let window = app.get_webview_window("main").unwrap();
                use window_vibrancy::apply_vibrancy;
                use window_vibrancy::NSVisualEffectMaterial;
                apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None)
                    .expect("Failed to apply vibrancy");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
