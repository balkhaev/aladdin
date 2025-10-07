import {
  Scripts,
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import Loader from "@/components/loader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ExchangeProvider } from "@/lib/exchange-context";
import type { RouterAppContext, getRouter } from "../router";
import "../index.css";

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Aladdin Trading Platform",
      },
      {
        name: "description",
        content: "Aladdin - Advanced Cryptocurrency Trading Platform",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  const isFetching = useRouterState({
    select: (s) => s.isLoading,
  });
  const router = useRouter<Awaited<ReturnType<typeof getRouter>>>();
  const queryClient = router.options.context.queryClient;

  return (
    <>
      <HeadContent />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          storageKey="vite-ui-theme"
        >
          <ExchangeProvider>
            {isFetching ? <Loader /> : <Outlet />}
            <Toaster richColors />
          </ExchangeProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      <Scripts />
      {/* <TanStackRouterDevtools position="bottom-left" /> */}
    </>
  );
}
