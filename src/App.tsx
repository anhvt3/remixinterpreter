import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ActivityLogProvider } from "./contexts/ActivityLogContext";
import App from "./ui/App";

const queryClient = new QueryClient();

const RootApp = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ActivityLogProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <App />
        </TooltipProvider>
      </ActivityLogProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default RootApp;
