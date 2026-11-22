import { type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import AgentsPage from '@/pages/agents';
import HomePage from '@/pages/home';
import ConnectPage from '@/pages/connect';
import AgentDetailPage from '@/pages/agent-detail';
import FixReviewPage from '@/pages/fix-review';
import { Shell } from '@/components/loop/shell';
import { ThemeProvider } from '@/components/loop/theme';
import { DemoProvider } from '@/lib/demo-store';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route>
        <AppRoutes />
      </Route>
    </Switch>
  );
}

function AppRoutes() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/agents" component={AgentsPage} />
          <Route path="/connect" component={ConnectPage} />
          <Route path="/agents/:id/fixes/:fixId" component={FixReviewPage} />
          <Route path="/agents/:id" component={AgentDetailPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ThemeProvider>
      <DemoProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </DemoProvider>
    </ThemeProvider>
  );
}

export default App;
