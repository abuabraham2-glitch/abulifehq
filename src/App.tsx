import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppProvider } from "@/contexts/AppContext";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Matrix from "./pages/Matrix";
import Triage from "./pages/Triage";
import Shopping from "./pages/Shopping";
import Notes from "./pages/Notes";
import More from "./pages/More";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <SonnerToaster position="bottom-center" richColors={false} toastOptions={{ style: { background: '#5C3D1E', color: '#fff', border: 'none' } }} />
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/matrix" element={<Matrix />} />
                <Route path="/triage" element={<Triage />} />
                <Route path="/shopping" element={<Shopping />} />
                <Route path="/grocery" element={<Navigate to="/shopping" replace />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/more" element={<More />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
