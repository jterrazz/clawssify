import { SiteHeader } from '@/components/site-header'
import { SiteSidebar } from '@/components/site-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'Clawssify',
  description: 'Your AI-powered personal knowledge base',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SidebarProvider>
          <SiteSidebar />
          <SidebarInset>
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}
