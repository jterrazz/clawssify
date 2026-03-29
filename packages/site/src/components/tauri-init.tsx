"use client";

import { useEffect } from "react";

export function TauriInit() {
  useEffect(() => {
    if ("__TAURI__" in window) {
      document.documentElement.classList.add("tauri");
    }
  }, []);
  return null;
}
