import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Tasks from "./pages/Tasks";
import TasksSimple from "./pages/TasksSimple";
import TasksDebug from "./pages/TasksDebug";
import TasksWorking from "./pages/TasksWorking";
import Calendar from "./pages/Calendar";
import RichTextEditorTest from "./pages/RichTextEditorTest";
import Playground from "./pages/Playground";
import NotFound from "./pages/NotFound";
import Inboxes from "./pages/Inboxes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tasks" element={<TasksWorking />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/test-editor" element={<RichTextEditorTest />} />
          <Route path="/inboxes" element={<Inboxes />} />
          <Route path="/documents" element={<Index />} /> {/* Placeholder for documents page */}
          <Route path="/settings" element={<Index />} /> {/* Placeholder for settings page */}
          <Route path="/profile" element={<Index />} /> {/* Placeholder for profile page */}
          <Route path="/menu" element={<Index />} /> {/* Placeholder for mobile menu page */}
          <Route path="/calendar" element={<Calendar />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

