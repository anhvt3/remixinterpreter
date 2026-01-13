import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ActivityLogProvider } from "./contexts/ActivityLogContext";
import { MissingFunctionsProvider } from "./contexts/MissingFunctionsContext";
import App from "./ui/App";

const queryClient = new QueryClient();

const RootApp = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ActivityLogProvider>
        <MissingFunctionsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <App />
          </TooltipProvider>
        </MissingFunctionsProvider>
      </ActivityLogProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default RootApp;
