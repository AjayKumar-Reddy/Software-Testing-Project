"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import axios from "axios";
import { AuthProvider } from "@/contexts/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => {
              const status = axios.isAxiosError(err) ? err.response?.status : undefined;
              if (status && status >= 400 && status < 500) return false;
              return count < 2;
            },
          },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <TooltipProvider delay={250}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
