import { type ReactNode, useEffect, useRef } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import AgentsPage from '@/pages/agents';
import HomePage from '@/pages/home';
import ConnectPage from '@/pages/connect';
import AgentDetailPage from '@/pages/agent-detail';
import FixReviewPage from '@/pages/fix-review';
import SampleAgentsPage from '@/pages/sample-agents';
import SampleConnectPage from '@/pages/sample-connect';
import { Shell } from '@/components/loop/shell';
import { LoopLogo } from '@/components/loop/mark';
import { ThemeProvider } from '@/components/loop/theme';
import { DemoProvider } from '@/lib/demo-store';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, useSearch, Router as WouterRouter } from 'wouter';

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient();

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#5B4BFF',
    colorForeground: '#1A1A2E',
    colorMutedForeground: '#77758C',
    colorDanger: '#B42345',
    colorBackground: '#FFFFFF',
    colorInput: '#FDFDFF',
    colorInputForeground: '#1A1A2E',
    colorNeutral: '#1A1A2E',
    fontFamily: 'Instrument Sans',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: '!w-full min-w-0 max-w-[440px] flex justify-center justify-self-center',
    cardBox: 'bg-white rounded-2xl !w-full !max-w-full min-w-0 overflow-hidden border border-[#E9E7F3] shadow-[0_24px_80px_-35px_rgba(42,34,100,.28)]',
    card: '!w-full min-w-0 !shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[#1A1A2E] font-semibold',
    headerSubtitle: 'text-[#77758C]',
    socialButtonsBlockButtonText: 'text-[#1A1A2E] font-medium',
    formFieldLabel: 'text-[#1A1A2E] font-medium',
    footerActionLink: 'text-[#5B4BFF] font-semibold',
    footerActionText: 'text-[#77758C]',
    dividerText: 'text-[#77758C]',
    identityPreviewEditButton: 'text-[#5B4BFF]',
    formFieldSuccessText: 'text-[#287D61]',
    alertText: 'text-[#1A1A2E]',
    logoBox: 'mb-3',
    logoImage: 'max-h-8',
    socialButtonsBlockButton: 'border-[#E9E7F3] bg-white hover:bg-[#F8F7FF]',
    formButtonPrimary: 'bg-[#5B4BFF] !text-white hover:bg-[#4938EE] shadow-none',
    formFieldInput: 'border-[#E4E1F0] bg-[#FDFDFF] text-[#1A1A2E]',
    footerAction: 'border-0',
    dividerLine: 'bg-[#E9E7F3]',
    alert: 'border-[#F0CBD3] bg-[#FFF7F8]',
    otpCodeFieldInput: 'border-[#E4E1F0] bg-white text-[#1A1A2E]',
    formFieldRow: 'gap-1.5',
    main: 'gap-5',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) client.clear();
    prevUserIdRef.current = userId;
  }), [addListener, client]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route><ProtectedRoutes /></Route>
    </Switch>
  );
}

function AuthPage({ kind }: { kind: 'sign-in' | 'sign-up' }) {
  const { isLoaded } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const candidate = params.get('redirect_url') ?? '/agents';
  const safeReturn = candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\') && !/\s/.test(candidate) ? candidate : '/agents';
  if (!isLoaded) return <AuthFrame><div className="h-72 w-full max-w-[440px] animate-pulse rounded-2xl bg-[#F0EEFF]" /></AuthFrame>;
  const returnUrl = `${basePath}${safeReturn}`;
  return <AuthFrame>{kind === 'sign-in'
    ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={returnUrl} />
    : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={returnUrl} />}</AuthFrame>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-[100dvh] bg-[#FDFDFF] px-5 py-8 text-[#1A1A2E]">
    <header className="mx-auto flex max-w-6xl items-center justify-between">
      <Link href="/" aria-label="loop home" className="rounded-md"><LoopLogo textClassName="text-xl" /></Link>
      <span className="font-mono text-[10px] uppercase tracking-[.17em] text-[#76748A]">voice agent improvement</span>
    </header>
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-6xl items-center justify-center py-10">
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="hidden max-w-lg lg:block">
          <span className="mb-6 inline-flex rounded-full border border-[#DDD9FF] bg-[#F5F3FF] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.15em] text-[#5B4BFF]">Private workspace</span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-.04em]">Keep making your agent <span className="text-[#5B4BFF]">better.</span></h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#68667A]">A self-correcting layer for the voice agents already in production.</p>
          <div aria-hidden className="mt-12 flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#5B4BFF]" /><span className="h-px w-16 bg-[#D8D3FF]" /><span className="h-2 w-2 rounded-full border border-[#A9A2D8]" /><span className="h-px w-16 bg-[#E5E2F3]" /><span className="h-2 w-2 rounded-full border border-[#C9C5D8]" />
          </div>
        </section>
        {children}
      </div>
    </div>
  </main>;
}

function SignInPage() { return <AuthPage kind="sign-in" />; }
function SignUpPage() { return <AuthPage kind="sign-up" />; }

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="min-h-[100dvh] animate-pulse bg-[#FDFDFF]" />;
  return isSignedIn ? <Redirect to="/agents" /> : <HomePage />;
}

function ProtectedRoutes() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [location] = useLocation();
  const search = useSearch();
  if (!isLoaded) return <div className="min-h-[100dvh] animate-pulse bg-[#FDFDFF]" />;
  if (!isSignedIn || !userId) return <Redirect to={`/sign-in?redirect_url=${encodeURIComponent(location + (search ? `?${search}` : ''))}`} />;
  return (
    <DemoProvider key={userId} userId={userId}>
      <Shell>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/agents" component={AgentsPage} />
            <Route path="/connect" component={ConnectPage} />
            <Route path="/agents/:id/fixes/:fixId" component={FixReviewPage} />
            <Route path="/agents/:id" component={AgentDetailPage} />
          <Route path="/sample" component={SampleAgentsPage} />
          <Route path="/sample/connect" component={SampleConnectPage} />
          <Route path="/sample/:id" component={AgentDetailPage} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </Shell>
    </DemoProvider>
  );
}

function ClerkApplication() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue improving your voice agent.' } },
      signUp: { start: { title: 'Make your agent better', subtitle: 'Create your private Loop workspace.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider><Router /><Toaster /></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkApplication />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
