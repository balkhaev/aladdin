"use client";

import {
  BarChart3,
  Bot,
  Briefcase,
  ChartCandlestick,
  ChevronRight,
  Home,
  LineChart,
  ListFilter,
  Settings,
  TrendingUp,
  Wallet,
  Activity,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Markets",
    icon: ChartCandlestick,
    items: [
      { title: "Overview", url: "/markets" },
      { title: "Macro", url: "/market/macro" },
      { title: "On-Chain", url: "/market/on-chain" },
      { title: "Spot Trading", url: "/markets/spot" },
      { title: "Futures", url: "/markets/futures" },
    ],
  },
  {
    title: "Portfolio",
    icon: Briefcase,
    items: [
      { title: "My Portfolios", url: "/portfolio" },
      { title: "Performance", url: "/portfolio/performance" },
      { title: "Risk Analysis", url: "/portfolio/risk" },
    ],
  },
  {
    title: "Trading",
    icon: ShoppingCart,
    items: [
      { title: "Orders", url: "/trading/orders" },
      { title: "Positions", url: "/trading/positions" },
      { title: "History", url: "/trading/history" },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    items: [
      { title: "Technical", url: "/analytics/technical" },
      { title: "Sentiment", url: "/analytics/sentiment" },
    ],
  },
  {
    title: "Automation",
    icon: Bot,
    items: [
      { title: "ML Models", url: "/automation/ml" },
      { title: "Signals", url: "/automation/signals" },
      { title: "Backtesting", url: "/automation/backtest" },
    ],
  },
  {
    title: "Screener",
    url: "/screener",
    icon: ListFilter,
  },
  {
    title: "Risk Management",
    url: "/risk",
    icon: TrendingUp,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-sidebar-border border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChartCandlestick className="size-4" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Coffee</span>
              <span className="text-muted-foreground text-xs">
                Trading Platform
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if (item.items) {
                  return (
                    <Collapsible asChild defaultOpen={false} key={item.title}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.url}
                                >
                                  <Link href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link href={item.url || "#"}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
