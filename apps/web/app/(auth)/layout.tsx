"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderTickers } from "@/components/header-tickers";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { WhaleAlertsPanel } from "@/components/whale-alerts-panel";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/market": "Обзор рынка",
  "/on-chain": "On-Chain",
  "/sentiment": "Sentiment",
  "/screener": "Скринер",
  "/automation": "Автотрейдинг",
  "/trading": "Торговый терминал",
  "/arbitrage": "Арбитраж",
  "/portfolio": "Портфель",
  "/settings": "Настройки",
  "/debug": "Отладка",
  "/admin/users": "Пользователи",
  "/bybit-opportunities": "Bybit Opportunities",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMarketPage = pathname === "/market";

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-border/50 border-b bg-card/20 backdrop-blur-sm">
          <div className="flex flex-1 items-center gap-2 px-2">
            <SidebarTrigger />
            <Separator className="mr-1 h-4" orientation="vertical" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs">
                    {PAGE_TITLES[pathname] || "Aladdin"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {isMarketPage && (
              <>
                <Separator className="mx-2 h-4" orientation="vertical" />
                <HeaderTickers />
              </>
            )}
          </div>
          <div className="flex items-center gap-2 px-2">
            <WhaleAlertsPanel />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
