import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Brain,
  Briefcase,
  Bug,
  LineChart,
  MessageSquare,
  Search,
  Settings,
  TrendingUp,
  Zap,
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const navigation = [
  {
    title: "Главная",
    items: [
      {
        title: "Обзор рынка",
        to: "/market",
        icon: LineChart,
        description: "Real-time данные и метрики",
      },
    ],
  },
  {
    title: "Торговля",
    items: [
      {
        title: "Терминал",
        to: "/trading",
        icon: TrendingUp,
        description: "Торговый терминал",
      },
      {
        title: "Портфель",
        to: "/portfolio",
        icon: Briefcase,
        description: "Управление позициями",
      },
      {
        title: "Скринер",
        to: "/screener",
        icon: Search,
        description: "Поиск возможностей",
      },
      {
        title: "Автотрейдинг",
        to: "/executor",
        icon: Zap,
        description: "Автоматическое исполнение",
      },
    ],
  },
  {
    title: "Аналитика",
    items: [
      {
        title: "Аналитика",
        to: "/analytics-unified",
        icon: BarChart3,
        description: "Метрики и intelligence",
      },
      {
        title: "Sentiment",
        to: "/sentiment",
        icon: MessageSquare,
        description: "Telegram & Twitter sentiment",
      },
      {
        title: "On-Chain",
        to: "/on-chain",
        icon: Activity,
        description: "Блокчейн метрики и whale tracking",
      },
      {
        title: "ML & HPO",
        to: "/ml",
        icon: Brain,
        description: "Машинное обучение и оптимизация",
      },
      {
        title: "Бэктестинг",
        to: "/backtest",
        icon: BarChart3,
        description: "Тестирование стратегий",
      },
    ],
  },
];

export function AppSidebar() {
  const router = useRouterState();
  const currentPath = router.location.pathname;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Aladdin</span>
            <span className="text-muted-foreground text-xs">
              Trading Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = currentPath === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link to={item.to}>
                          <item.icon />
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
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Отладка">
              <Link to="/debug">
                <Bug />
                <span>Отладка</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Настройки">
              <Link to="/settings">
                <Settings />
                <span>Настройки</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-between px-2 group-data-[collapsible=icon]:justify-center">
          <div className="group-data-[collapsible=icon]:hidden">
            <UserMenu />
          </div>
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
