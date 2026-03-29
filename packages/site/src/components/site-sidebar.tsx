"use client";

import { useEffect, useState } from "react";

import { SidebarNav } from "@/components/sidebar-nav";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { getSidebarTreeClient } from "@/lib/content-client";
import type { SidebarItem } from "@/lib/content-types";
import { isTauri } from "@/lib/tauri";

const sectionConfig = [
  { key: "wiki", label: "Wiki", href: "/wiki" },
  { key: "posts", label: "Posts", href: "/posts" },
  { key: "digest", label: "Digest", href: "/digest" },
];

export function SiteSidebar({
  initialSections,
}: {
  initialSections?: { key: string; label: string; href: string; items: SidebarItem[] }[];
}) {
  const [sections, setSections] = useState(initialSections ?? []);

  useEffect(() => {
    if (isTauri) {
      Promise.all(sectionConfig.map((s) => getSidebarTreeClient(s.key))).then((trees) => {
        const result = sectionConfig
          .map((config, i) => ({ ...config, items: trees[i] }))
          .filter((s) => s.items.length > 0);
        setSections(result);
      });
    }
  }, []);

  return (
    <Sidebar className="border-r border-border/40 tauri-drag-region">
      <SidebarContent className={`px-1 ${isTauri ? "pt-8" : "pt-1"}`}>
        {sections.map((section, i) => (
          <div key={section.key}>
            {i > 0 && <Separator className="mx-3" />}
            <SidebarNav
              href={section.href}
              items={section.items}
              label={section.label}
              sectionKey={section.key}
            />
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
