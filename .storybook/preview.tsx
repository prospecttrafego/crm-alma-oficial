import type { Preview } from "@storybook/react";
import React, { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

import { installStorybookApiMock } from "./apiMock";

import "../client/src/index.css";

installStorybookApiMock();

// Avoid browser permission prompts while exploring components in Storybook.
try {
  if ("Notification" in window && typeof Notification.requestPermission === "function") {
    Notification.requestPermission = async () => "denied";
  }
} catch {
  // Ignore if Notification API is not writable in the current environment.
}

function StorybookProviders({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
  }, []);

  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <div className="min-h-screen bg-background p-4 text-foreground">{children}</div>
          </TooltipProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <StorybookProviders>
        <Story />
      </StorybookProviders>
    ),
  ],
  parameters: {
    controls: { expanded: true },
    layout: "centered",
  },
};

export default preview;
