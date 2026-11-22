import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Eye, ScanSearch, Wrench, ShieldCheck, Rocket, KeyRound, ClipboardPaste, MousePointerClick, Github } from "lucide-react";
import { LoopLogo, LoopMark } from "@/components/loop/mark";

const HEADLINE = "Your voice agent, better every week.";
const SUBHEAD = "Loop watches your agent's real calls, finds what went wrong, writes the fix, and proves it works before it goes live.";

const STEPS = [
  { t: "Watch", d: "Loop reads every call your agent takes.", icon: Eye },
  { t: "Spot", d: "Failures are grouped into clear issues.", icon: ScanSearch },
  { t: "Fix", d: "Loop rewrites the prompt for that issue.", icon: Wrench },
  { t: "Prove", d: "The fix runs against tests built from real failures.", icon: ShieldCheck },
  { t: "Ship", d: "You approve, it goes live. Every version can be rolled back.", icon: Rocket },
];

const CONNECT = [
  { d: "Create an API key in ElevenLabs (Developers > API Keys).", icon: KeyRound },
  { d: "Paste it into Loop.", icon: ClipboardPaste },
  { d: "Pick your agent. Loop starts watching.", icon: MousePointerClick },
];

function setMeta(sel: string, attr: string, key: string, value: string) {
  let el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", value);
}

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export default function HomePage() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Loop — ${HEADLINE}`;
    setMeta('meta[name="description"]', "name", "description", SUBHEAD);
    setMeta('meta[property="og:title"]', "property", "og:title", HEADLINE);
    setMeta('meta[property="og:description"]', "property", "og:description", SUBHEAD);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", HEADLINE);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", SUBHEAD);
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="home min-h-[100dvh] overflow-x-hidden bg-[#FDFDFF] text-[#1A1A2E]" style={{ colorScheme: "light" }}>
      <a href="#main" className={`sr-only z-50 rounded-md bg-[#5B4BFF] px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focus}`}>Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-[#1A1A2E]/[.06] bg-[#FDFDFF]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="loop home" data-testid="link-home" className={`rounded-md ${focus}`}><LoopLogo textClassName="text-xl" /></Link>
          <nav aria-label="Sections" className="ml-auto hidden items-center gap-1 text-sm text-[#1A1A2E]/60 md:flex">
            <a href="#how" data-testid="link-nav-how" className={`rounded-md px-3 py-1.5 transition-colors hover:text-[#1A1A2E] ${focus}`}>How it works</a>
            <a href="#connect" data-testid="link-nav-connect" className={`rounded-md px-3 py-1.5 transition-colors hover:text-[#1A1A2E] ${focus}`}>Connect in 2 minutes</a>
            <a href="#promise" data-testid="link-nav-promise" className={`rounded-md px-3 py-1.5 transition-colors hover:text-[#1A1A2E] ${focus}`}>Our promise</a>
          </nav>
          <Link href="/connect" data-testid="link-connect-header" className={`ml-auto inline-flex h-9 items-center rounded-full bg-[#1A1A2E] px-4 text-sm font-medium text-white transition-transform active:scale-[.97] md:ml-2 ${focus}`}>Connect your agent</Link>
        </div>
      </header>

      <main id="main">
        {/* HERO */}
        <section aria-labelledby="hero-title" className="relative px-5 pb-28 pt-20 sm:px-8 sm:pt-28 md:pb-40">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-6 -z-0 -translate-x-1/2 opacity-[.07]">
            <LoopMark className="home-spin h-[520px] w-[520px] sm:h-[760px] sm:w-[760px]" />
          </div>
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="home-rise mx-auto mb-10 w-fit" style={{ animationDelay: "0ms" }}>
              <LoopMark className="h-16 w-16" />
            </div>
            <h1 id="hero-title" data-testid="text-hero-title" className="home-rise font-display text-[clamp(2.6rem,8vw,5.75rem)] font-semibold leading-[.98] tracking-[-.035em]" style={{ animationDelay: "80ms" }}>
              Your voice agent, <span className="text-[#5B4BFF]">better every week.</span>
            </h1>
            <p data-testid="text-hero-subhead" className="home-rise mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-[#1A1A2E]/65 sm:text-xl" style={{ animationDelay: "180ms" }}>{SUBHEAD}</p>
            <div className="home-rise mt-12" style={{ animationDelay: "280ms" }}>
              <Link href="/connect" data-testid="link-connect-hero" className={`group inline-flex h-14 items-center gap-3 rounded-full bg-[#5B4BFF] pl-7 pr-2 text-base font-medium text-white shadow-[0_18px_40px_-16px_rgba(91,75,255,.7)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-[.98] ${focus}`}>
                Connect your agent
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5"><ArrowRight className="h-4 w-4" /></span>
              </Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-t border-[#1A1A2E]/[.06] px-5 py-24 sm:px-8 md:py-32">
          <div className="mx-auto max-w-6xl">
            <h2 id="how-title" className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">How it works</h2>
            <ol className="relative mt-16 grid gap-0 md:grid-cols-5 md:gap-6">
              <span aria-hidden className="absolute left-[23px] top-6 bottom-6 w-px bg-gradient-to-b from-[#5B4BFF]/40 via-[#5B4BFF]/20 to-[#5B4BFF]/40 md:left-6 md:right-6 md:top-[23px] md:bottom-auto md:h-px md:w-auto md:bg-gradient-to-r" />
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const last = i === STEPS.length - 1;
                return (
                  <li key={s.t} data-testid={`step-how-${i + 1}`} className="home-rise relative grid grid-cols-[48px_1fr] gap-5 pb-10 md:block md:pb-0" style={{ animationDelay: `${i * 70}ms` }}>
                    <span className={`relative z-10 grid h-12 w-12 place-items-center rounded-full border ${last ? "border-[#5B4BFF] bg-[#5B4BFF] text-white" : "border-[#5B4BFF]/25 bg-white text-[#5B4BFF]"}`}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="pt-1 md:mt-7 md:pt-0">
                      <h3 className="flex items-baseline gap-2 text-lg font-semibold">
                        <span className="font-mono text-xs text-[#5B4BFF]">{i + 1}.</span>{s.t}
                      </h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-[#1A1A2E]/60">{s.d}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* CONNECT */}
        <section id="connect" aria-labelledby="connect-title" className="scroll-mt-20 px-5 py-24 sm:px-8 md:py-32">
          <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-[1fr_1.4fr] md:gap-20">
            <div>
              <h2 id="connect-title" className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Connect in <span className="text-[#5B4BFF]">2 minutes</span>
              </h2>
              <Link href="/connect" data-testid="link-connect-section" className={`group mt-10 hidden items-center gap-2 rounded-md text-sm font-medium text-[#5B4BFF] md:inline-flex ${focus}`}>
                Connect your agent <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <ol className="divide-y divide-[#1A1A2E]/[.07] rounded-3xl border border-[#1A1A2E]/[.07] bg-white shadow-[0_30px_60px_-40px_rgba(26,26,46,.25)]">
              {CONNECT.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={i} data-testid={`step-connect-${i + 1}`} className="flex items-start gap-5 p-6 sm:p-8">
                    <span className="font-display text-4xl font-semibold leading-none text-[#5B4BFF]/25 tabular">{i + 1}</span>
                    <p className="flex-1 pt-1.5 text-base leading-relaxed sm:text-lg">{s.d}</p>
                    <Icon className="mt-2 hidden h-5 w-5 shrink-0 text-[#5B4BFF] sm:block" aria-hidden />
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* PROMISE */}
        <section id="promise" aria-labelledby="promise-title" className="scroll-mt-20 px-5 pb-28 pt-8 sm:px-8 md:pb-40">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#5B4BFF] px-7 py-16 text-white sm:px-14 sm:py-24">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 opacity-[.12] [&_path]:!stroke-white">
              <LoopMark className="h-[420px] w-[420px]" />
            </div>
            <h2 id="promise-title" className="relative font-mono text-xs uppercase tracking-[.22em] text-white/70">Our promise</h2>
            <p data-testid="text-promise" className="relative mt-8 max-w-3xl font-display text-[clamp(1.75rem,4.4vw,3.25rem)] font-semibold leading-[1.1] tracking-tight">
              Loop never ships a fix that breaks something that worked before.{" "}
              <span className="text-white/65">Nothing goes live without your approval.</span>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1A1A2E]/[.06] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-[#1A1A2E]/60 sm:flex-row sm:items-center">
          <Link href="/" aria-label="loop home" data-testid="link-footer-home" className={`w-fit rounded-md text-[#1A1A2E] ${focus}`}><LoopLogo markClassName="h-6 w-6" textClassName="text-base" /></Link>
          <p data-testid="text-footer">Built at The Product Folks hackathon, Nov 2026.</p>
          <a href="https://github.com/ManasiGupta/TPF-Replit-loopAutoCorrect" target="_blank" rel="noopener noreferrer" data-testid="link-github" className={`inline-flex w-fit items-center gap-1.5 rounded-md hover:text-[#1A1A2E] sm:ml-auto ${focus}`}>
            <Github className="h-4 w-4" aria-hidden /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
