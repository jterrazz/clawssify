//! File locking — port of `server/src/services/storage/file-lock.ts`.
//!
//! Uses a simple .lock file approach since proper-lockfile is a Node.js package.

use crate::CoreError;
use std::path::Path;
use tokio::fs;
use tokio::time::{sleep, Duration};

const MAX_RETRIES: u32 = 3;
const RETRY_DELAY_MS: u64 = 100;

/// Execute a closure while holding an advisory file lock.
pub async fn with_file_lock<F, Fut, T>(path: &Path, f: F) -> Result<T, CoreError>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, CoreError>>,
{
    let lock_path = path.with_extension("lock");

    // Try to acquire the lock
    for attempt in 0..=MAX_RETRIES {
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
            .await
        {
            Ok(_) => {
                let result = f().await;
                // Always release the lock
                let _ = fs::remove_file(&lock_path).await;
                return result;
            }
            Err(_) if attempt < MAX_RETRIES => {
                sleep(Duration::from_millis(RETRY_DELAY_MS * (attempt as u64 + 1))).await;
            }
            Err(_) => {
                // Force-release stale lock and try once more
                let _ = fs::remove_file(&lock_path).await;
                match fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&lock_path)
                    .await
                {
                    Ok(_) => {
                        let result = f().await;
                        let _ = fs::remove_file(&lock_path).await;
                        return result;
                    }
                    Err(e) => {
                        return Err(CoreError::Storage {
                            msg: format!("Failed to acquire file lock: {e}"),
                        });
                    }
                }
            }
        }
    }

    Err(CoreError::Storage {
        msg: "Failed to acquire file lock after retries".into(),
    })
}
