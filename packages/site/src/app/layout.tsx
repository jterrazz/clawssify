import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { SiteSidebar } from "@/components/site-sidebar";
import { TauriInit } from "@/components/tauri-init";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Clawssify",
  description: "Your AI-powered personal knowledge base",
};

async function getInitialSections() {
  if (process.env.TAURI_BUILD) {
    return undefined;
  }
  try {
    const { getSidebarTree } = await import("@/lib/content");
    const sectionConfig = [
      { key: "wiki", label: "Wiki", href: "/wiki" },
      { key: "posts", label: "Posts", href: "/posts" },
      { key: "digest", label: "Digest", href: "/digest" },
    ];
    const trees = await Promise.all(sectionConfig.map((s) => getSidebarTree(s.key)));
    return sectionConfig
      .map((config, i) => ({ ...config, items: trees[i] }))
      .filter((s) => s.items.length > 0);
  } catch {
    return undefined;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialSections = await getInitialSections();

  return (
    <html className={`${inter.variable} ${jetbrainsMono.variable}`} lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <TauriInit />
        <SidebarProvider>
          <SiteSidebar initialSections={initialSections} />
          <SidebarInset>
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
