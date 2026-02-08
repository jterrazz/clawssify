import Link from 'next/link'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { getSidebarTree, type SidebarItem } from '@/lib/content'

export async function SiteSidebar() {
  const [wiki, posts, digest] = await Promise.all([
    getSidebarTree('wiki'),
    getSidebarTree('posts'),
    getSidebarTree('digest'),
  ])

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarSection title="Wiki" items={wiki} />
        <SidebarSection title="Posts" items={posts} />
        <SidebarSection title="Digest" items={digest} />
      </SidebarContent>
    </Sidebar>
  )
}

function SidebarSection({ title, items }: { title: string; items: SidebarItem[] }) {
  if (items.length === 0) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarNavItem key={item.title} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function SidebarNavItem({ item }: { item: SidebarItem }) {
  if (item.children) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton>{item.title}</SidebarMenuButton>
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.title}>
              {child.href ? (
                <SidebarMenuSubButton asChild>
                  <Link href={child.href}>{child.title}</Link>
                </SidebarMenuSubButton>
              ) : (
                <SidebarMenuSubButton>{child.title}</SidebarMenuSubButton>
              )}
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      {item.href ? (
        <SidebarMenuButton asChild>
          <Link href={item.href}>{item.title}</Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton>{item.title}</SidebarMenuButton>
      )}
    </SidebarMenuItem>
  )
}
