import { SidebarNav } from '@/components/sidebar-nav'
import { Separator } from '@/components/ui/separator'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { getSidebarTree } from '@/lib/content'

const sectionConfig = [
  { key: 'wiki', label: 'Wiki', href: '/wiki' },
  { key: 'posts', label: 'Posts', href: '/posts' },
  { key: 'digest', label: 'Digest', href: '/digest' },
]

export async function SiteSidebar() {
  const trees = await Promise.all(sectionConfig.map((s) => getSidebarTree(s.key)))

  const sections = sectionConfig
    .map((config, i) => ({
      ...config,
      items: trees[i],
    }))
    .filter((s) => s.items.length > 0)

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarContent className="px-1 pt-1">
        {sections.map((section, i) => (
          <div key={section.key}>
            {i > 0 && <Separator className="mx-3" />}
            <SidebarNav
              label={section.label}
              href={section.href}
              sectionKey={section.key}
              items={section.items}
            />
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
