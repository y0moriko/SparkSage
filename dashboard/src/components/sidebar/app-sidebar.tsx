"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Zap,
  LayoutDashboard,
  BarChart3,
  Cpu,
  Settings,
  MessageSquare,
  Wand2,
  LogOut,
  HelpCircle,
  Shield,
  Hash,
  Server,
  Puzzle,
  UserCircle,
  BookOpen,
  Terminal,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
// import { ModeToggle } from "@/components/ui/mode-toggle"; // Removed direct import

import dynamic from 'next/dynamic';

const DynamicModeToggle = dynamic(
  () => import('@/components/ui/mode-toggle').then((mod) => mod.ModeToggle),
  { ssr: false }
);

const GENERAL_ITEMS = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
];

const BOT_CONFIG_ITEMS = [
  { title: "Server Settings", href: "/dashboard/server-settings", icon: Server },
  { title: "Channels", href: "/dashboard/prompts", icon: Hash },
  { title: "Knowledge", href: "/dashboard/knowledge", icon: BookOpen },
  { title: "Custom Commands", href: "/dashboard/custom-commands", icon: Terminal },
  { title: "FAQs", href: "/dashboard/faqs", icon: HelpCircle },
  { title: "Permissions", href: "/dashboard/permissions", icon: Shield },
  { title: "Plugins", href: "/dashboard/plugins", icon: Puzzle },
];

const GLOBAL_CONFIG_ITEMS = [
  { title: "Providers", href: "/dashboard/providers", icon: Cpu },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground dark:bg-white dark:text-black">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <span className="font-semibold">SparkSage</span>
          </div>
          <DynamicModeToggle /> {/* Using dynamic import */}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {GENERAL_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Bot Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {BOT_CONFIG_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {GLOBAL_CONFIG_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/wizard"}>
                  <Link href="/wizard">
                    <Wand2 className="h-4 w-4" />
                    <span>Setup Wizard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
