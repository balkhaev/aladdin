import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
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
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthLayout,
});

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Дашборд",
  "/trading": "Торговый терминал",
  "/portfolio": "Портфель",
  "/screener": "Скринер",
  "/analytics": "Аналитика",
  "/analytics-unified": "Аналитика",
  "/sentiment": "Social Sentiment",
  "/backtest": "Бэктестинг",
  "/on-chain": "On-Chain данные",
  "/market": "Обзор рынка",
  "/ml": "ML & HPO",
  "/debug": "Отладка",
  "/settings": "Настройки",
};

function AuthLayout() {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator className="mr-2 h-4" orientation="vertical" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {PAGE_TITLES[window.location.pathname] || "Aladdin"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 px-3">
            <WhaleAlertsPanel />
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
