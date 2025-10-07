"use client";

import {
  Activity,
  Brain,
  Briefcase,
  Bug,
  LineChart,
  MessageSquare,
  Search,
  Settings,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const navigation = [
  {
    title: "Аналитика",
    items: [
      {
        title: "Обзор рынка",
        to: "/market",
        icon: TrendingUp,
      },
      {
        title: "On-Chain",
        to: "/on-chain",
        icon: Activity,
      },
      {
        title: "Sentiment",
        to: "/sentiment",
        icon: MessageSquare,
      },
      {
        title: "Скринер",
        to: "/screener",
        icon: Search,
      },
      {
        title: "Bybit Opportunities",
        to: "/bybit-opportunities",
        icon: Zap,
      },
    ],
  },
  {
    title: "Торговля",
    items: [
      {
        title: "Автотрейдинг",
        to: "/automation",
        icon: Zap,
      },
      {
        title: "Терминал",
        to: "/trading",
        icon: LineChart,
      },
      {
        title: "Арбитраж",
        to: "/arbitrage",
        icon: Brain,
      },
      {
        title: "Портфель",
        to: "/portfolio",
        icon: Briefcase,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const currentPath = pathname;
  const { data: session } = authClient.useSession();
  const sessionUser = session?.user as unknown as User;

  // Проверяем, является ли пользователь администратором
  const isAdmin = sessionUser?.role === "admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b py-2">
        <div className="flex items-center gap-2 px-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="size-3.5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-xs">Aladdin</span>
            <span className="text-[10px] text-muted-foreground">
              Trading Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup className="py-1" key={section.title}>
            <SidebarGroupLabel className="px-2 text-[10px]">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = currentPath === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        className="h-8 text-xs"
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.to}>
                          <item.icon className="size-3.5" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Раздел администрирования для админов */}
        {isAdmin && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="px-2 text-[10px]">
              Администрирование
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="h-8 text-xs"
                    isActive={currentPath === "/admin/users"}
                    tooltip="Пользователи"
                  >
                    <Link href="/admin/users">
                      <Users className="size-3.5" />
                      <span>Пользователи</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-8 text-xs"
              tooltip="Настройки"
            >
              <Link href="/settings">
                <Settings className="size-3.5" />
                <span>Настройки</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {process.env.NODE_ENV === "development" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="h-8 text-xs"
                tooltip="Отладка"
              >
                <Link href="/debug">
                  <Bug className="size-3.5" />
                  <span>Отладка</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="group-data-[collapsible=icon]:hidden">
            <UserMenu />
          </div>
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
