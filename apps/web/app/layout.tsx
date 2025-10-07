import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ExchangeProvider } from "@/lib/exchange-context";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aladdin Trading Platform",
  description: "Aladdin - Advanced Cryptocurrency Trading Platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
            storageKey="vite-ui-theme"
          >
            <ExchangeProvider>{children}</ExchangeProvider>
            <Toaster richColors />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
