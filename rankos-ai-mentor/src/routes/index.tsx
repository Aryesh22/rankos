import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  Flame,
  Github,
  Linkedin,
  Menu,
  Minus,
  Network,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Twitter,
  X,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Reveal, AnimatedNumber } from "@/components/ui-kit/Motion";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const exams = ["JEE", "NEET", "UPSC", "GATE", "CAT", "SSC", "Banking", "CLAT", "NDA"];

const failures = [
  {
    title: "You study hard, blindly",
    detail: "No system tells you which 6 chapters are actually costing you 40 marks.",
  },
  {
    title: "Mistakes repeat forever",
    detail: "The same calculation slip appears in mock 4, 9 and 14 — nobody tracked it.",
  },
  {
    title: "Revision is guesswork",
    detail: "You revise what feels weak, not what your memory curve says is decaying.",
  },
];

const fixes = [
  {
    title: "Exam DNA",
    detail:
      "A behavioural fingerprint of how you actually attempt a paper — speed, guessing, burnout.",
  },
  {
    title: "Mistake Bank",
    detail: "Every error auto-classified into 7 types, then scheduled until it never returns.",
  },
  {
    title: "Adaptive plan",
    detail: "A daily plan rewritten each night from yesterday's evidence, not a fixed timetable.",
  },
];

const features = [
  {
    icon: Brain,
    title: "Exam DNA Engine",
    body: "Speed, accuracy, confidence, guess rate, calculation vs concept errors, burnout risk and retention — measured after every attempt.",
  },
  {
    icon: Target,
    title: "Mistake Bank",
    body: "Mistakes are grouped into concept, formula, calculation, memory, guess, time-pressure and careless errors — with priority and revision status.",
  },
  {
    icon: Network,
    title: "Revision Graph",
    body: "Your syllabus as a living knowledge graph. Nodes shift colour as mastery decays, so revision stops being a guess.",
  },
  {
    icon: Timer,
    title: "Real Exam Simulator",
    body: "Fullscreen palette, timer, calculator, mark-for-review and keyboard navigation — identical to the real console.",
  },
  {
    icon: TrendingUp,
    title: "Predicted AIR",
    body: "Rank projection from percentile trends across 1.4M attempts, with the exact marks needed to hit your target.",
  },
  {
    icon: Sparkles,
    title: "24×7 AI Mentor",
    body: "It has read all your attempts. Ask why your percentile dropped and get an answer grounded in your own data.",
  },
];

const steps = [
  {
    n: "01",
    title: "Take a diagnostic",
    body: "One 90-minute adaptive paper maps your current standing across every chapter.",
  },
  {
    n: "02",
    title: "Get your Exam DNA",
    body: "RankOS builds a behavioural profile — where you lose marks and, more importantly, why.",
  },
  {
    n: "03",
    title: "Follow the daily OS",
    body: "A plan that rewrites itself nightly, mixing new concepts, drills and spaced revision.",
  },
  {
    n: "04",
    title: "Watch the rank move",
    body: "Every attempt updates your predicted AIR and the gap to your dream college.",
  },
];

const stories = [
  {
    name: "Ritika Sharma",
    result: "AIR 812 → JEE Advanced 2025",
    quote:
      "My accuracy was 58% and I couldn't explain why. The Mistake Bank showed 61% of my losses were calculation, not concept. Four weeks of drills and I gained 46 marks.",
    tag: "IIT Delhi, Electrical",
  },
  {
    name: "Aditya Verma",
    result: "NEET 2025 · 682/720",
    quote:
      "The revision graph is the only reason Botany stayed alive for me. It kept surfacing decayed topics before I forgot them, not after a bad test.",
    tag: "AIIMS Delhi",
  },
  {
    name: "Shruti Bansal",
    result: "UPSC CSE 2024 · Rank 214",
    quote:
      "Two years of self-study with no feedback loop. RankOS gave me the one thing coaching never did — a mirror that was honest every single day.",
    tag: "IAS, Bihar cadre",
  },
];

const comparison = [
  ["Personal attention", "1 teacher : 200 students", "1 AI mentor : 1 student"],
  ["Feedback speed", "Weekly, if at all", "Within 90 seconds of a test"],
  ["Mistake tracking", "Your own notebook", "Auto-classified into 7 error types"],
  ["Plan", "Fixed batch timetable", "Rewritten nightly from your data"],
  ["Revision", "Whatever feels weak", "Memory-decay driven scheduling"],
  ["Cost per year", "₹1.4L – ₹2.6L", "₹4,788"],
];

const pricing = [
  {
    name: "Starter",
    price: "₹0",
    period: "forever",
    desc: "For students testing the waters.",
    features: [
      "2 mock tests / month",
      "Basic result analysis",
      "Mistake Bank (50 entries)",
      "Daily plan",
    ],
    cta: "Start free",
  },
  {
    name: "Rank",
    price: "₹399",
    period: "/month",
    desc: "The full operating system.",
    features: [
      "Unlimited tests & custom generator",
      "Full Exam DNA engine",
      "Unlimited Mistake Bank",
      "Revision Graph & spaced repetition",
      "Predicted AIR + top-performer benchmark",
      "24×7 AI mentor",
    ],
    cta: "Start 7-day trial",
    highlighted: true,
  },
  {
    name: "Institute",
    price: "Custom",
    period: "",
    desc: "For coaching centres and schools.",
    features: [
      "Teacher dashboard",
      "Batch analytics",
      "Parent reports",
      "White-label tests",
      "Dedicated success manager",
    ],
    cta: "Talk to sales",
  },
];

const faqs = [
  {
    q: "Is RankOS a replacement for my coaching?",
    a: "No. RankOS is the layer above it. Your coaching delivers content; RankOS measures what actually stuck, catches the errors nobody logs, and decides what you do tonight.",
  },
  {
    q: "Which exams are supported?",
    a: "JEE Main & Advanced, NEET, UPSC CSE, GATE, CAT, SSC CGL and Banking (IBPS/SBI). CLAT and NDA are in beta.",
  },
  {
    q: "How accurate is the predicted AIR?",
    a: "Predictions are modelled on percentile trajectories from over 1.4 million attempts. For students with six or more full mocks, the projection has held within ±11% of the final rank band.",
  },
  {
    q: "What exactly is Exam DNA?",
    a: "A behavioural fingerprint built from every question you attempt — how long you take, when you guess, whether an error was conceptual or arithmetic, and how fast your retention decays per chapter.",
  },
  {
    q: "Do my parents see everything?",
    a: "Only what you enable. The parent dashboard shows study time, consistency and subject trends — never individual question data or chat with your mentor.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly plans cancel in one click and you keep access until the end of the billing period. No calls, no retention scripts.",
  },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
    { href: "#compare", label: "vs Coaching" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className="glass fixed inset-x-0 top-0 z-50 border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/signup">Start free</Link>
          </Button>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="space-y-1 border-t border-border px-5 py-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-muted-foreground"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="flex-1 rounded-full">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="flex-1 rounded-full">
              <Link to="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function ProductPreview() {
  const [tab, setTab] = useState<"dna" | "plan" | "mistakes">("dna");
  const tabs = [
    { id: "dna", label: "Exam DNA" },
    { id: "plan", label: "Today's Plan" },
    { id: "mistakes", label: "Mistake Bank" },
  ] as const;

  return (
    <div className="surface overflow-hidden shadow-soft">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <div className="mx-auto flex gap-1 rounded-full border border-border p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-3">
        {tab === "dna" &&
          [
            { k: "Predicted AIR", v: "1,240", s: "target 480", tone: "text-primary" },
            { k: "Retention score", v: "83", s: "+6 this week", tone: "text-success" },
            { k: "Burnout risk", v: "Moderate", s: "3 late nights", tone: "text-warning" },
          ].map((c) => (
            <div key={c.k} className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.k}</p>
              <p className={cn("mt-2 text-2xl font-semibold", c.tone)}>{c.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.s}</p>
            </div>
          ))}

        {tab === "plan" &&
          [
            { k: "06:30 · Physics", v: "Angular momentum", s: "55 min · concept" },
            { k: "16:00 · Maths", v: "Definite integration", s: "30 min · revision #4" },
            { k: "20:00 · Mock", v: "Part Test 07", s: "120 min · hard" },
          ].map((c) => (
            <div key={c.k} className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.k}</p>
              <p className="mt-2 text-[15px] font-medium">{c.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.s}</p>
            </div>
          ))}

        {tab === "mistakes" &&
          [
            { k: "Concept error", v: "34%", s: "Rotational motion leads" },
            { k: "Calculation error", v: "26%", s: "log & exponent slips" },
            { k: "Guess rate", v: "10%", s: "down from 21%" },
          ].map((c) => (
            <div key={c.k} className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.k}</p>
              <p className="mt-2 text-2xl font-semibold">{c.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.s}</p>
            </div>
          ))}
      </div>

      <div className="border-t border-border p-4 sm:p-6">
        <div className="flex items-end gap-1.5">
          {[42, 48, 51, 58, 55, 63, 69, 66, 74, 78, 82, 88].map((h, i) => (
            <motion.span
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 rounded-t-sm bg-brand-gradient"
              style={{ minHeight: 6, height: `${h}%` }}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Percentile trajectory · last 12 attempts
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-40">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]" />
        <div
          className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12px] text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Trusted by 2,40,000+ aspirants across 214 cities
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 text-[40px] font-semibold leading-[1.05] sm:text-6xl md:text-[68px]"
          >
            Students don't fail because
            <br className="hidden sm:block" /> they study less.
            <span className="block text-gradient">They fail because nothing measures them.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]"
          >
            RankOS is an AI mentor that reads every attempt you make, finds the exact reason you
            lose marks, and rewrites your plan every night until the reason disappears.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="w-full rounded-full px-7 sm:w-auto">
              <Link to="/signup">
                Build my Exam DNA <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-full px-7 sm:w-auto"
            >
              <Link to="/app">See a live dashboard</Link>
            </Button>
          </motion.div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {exams.map((e) => (
              <span
                key={e}
                className="text-[12px] font-medium tracking-wide text-muted-foreground/70"
              >
                {e}
              </span>
            ))}
          </div>
        </div>

        <Reveal delay={0.1} className="relative mx-auto mt-16 max-w-5xl">
          <ProductPreview />
        </Reveal>
      </section>

      {/* Why students fail / how RankOS fixes */}
      <section className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">
                Why students fail
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">The invisible leak</h2>
            </Reveal>
            <div className="mt-8 space-y-5">
              {failures.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.07}>
                  <div className="flex gap-4">
                    <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-destructive/12">
                      <Minus className="h-3.5 w-3.5 text-destructive" />
                    </span>
                    <div>
                      <p className="font-medium">{f.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {f.detail}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <div>
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-success">
                How RankOS fixes it
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">A closed feedback loop</h2>
            </Reveal>
            <div className="mt-8 space-y-5">
              {fixes.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.07}>
                  <div className="flex gap-4">
                    <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success/12">
                      <Check className="h-3.5 w-3.5 text-success" />
                    </span>
                    <div>
                      <p className="font-medium">{f.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {f.detail}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border px-5 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { v: 240000, s: "+", l: "Active aspirants" },
            { v: 1.4, s: "M", l: "Attempts analysed", d: 1 },
            { v: 38, s: "%", l: "Avg. accuracy lift in 60 days" },
            { v: 4.9, s: "/5", l: "Play Store rating", d: 1 },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 0.06} className="text-center md:text-left">
              <p className="text-3xl font-semibold sm:text-4xl">
                <AnimatedNumber value={s.v} decimals={s.d ?? 0} suffix={s.s} />
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              AI features
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[42px]">
              Six systems that replace guesswork
            </h2>
            <p className="mt-4 text-muted-foreground">
              Each one runs on your own attempt data. Nothing here is a generic recommendation
              engine.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="surface hover-lift group h-full p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-muted transition-colors group-hover:border-primary/40">
                    <f.icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-[15px] font-semibold">{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[42px]">Four steps, then a loop</h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.06}>
                <div className="h-full bg-card p-6">
                  <p className="text-[12px] font-semibold text-primary">{s.n}</p>
                  <h3 className="mt-4 text-[15px] font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Student success
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[42px]">Ranks, not testimonials</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {stories.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.07}>
                <figure className="surface hover-lift flex h-full flex-col p-6">
                  <blockquote className="flex-1 text-[14px] leading-relaxed text-foreground/90">
                    “{s.quote}”
                  </blockquote>
                  <figcaption className="mt-6 border-t border-border pt-4">
                    <p className="text-[14px] font-medium">{s.name}</p>
                    <p className="text-[12px] text-primary">{s.result}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{s.tag}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              RankOS vs traditional coaching
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[42px]">
              One of these knows your name
            </h2>
          </Reveal>

          <Reveal delay={0.08} className="mt-10">
            <div className="surface overflow-hidden">
              <div className="grid grid-cols-3 border-b border-border bg-muted/40 px-5 py-3 text-[12px] font-medium">
                <span className="text-muted-foreground">Dimension</span>
                <span className="text-muted-foreground">Coaching institute</span>
                <span className="text-primary">RankOS</span>
              </div>
              {comparison.map(([dim, a, b], i) => (
                <div
                  key={dim}
                  className={cn(
                    "grid grid-cols-3 items-center gap-3 px-5 py-4 text-[13px]",
                    i !== comparison.length - 1 && "border-b border-border",
                  )}
                >
                  <span className="font-medium">{dim}</span>
                  <span className="text-muted-foreground">{a}</span>
                  <span className="flex items-start gap-1.5 font-medium">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    {b}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[42px]">
              Less than one week of coaching
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              No admission fee, no two-year lock-in, no bus route. Cancel in one click.
            </p>
          </Reveal>

          <div className="mt-12 grid items-start gap-4 md:grid-cols-3">
            {pricing.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.07}>
                <div
                  className={cn(
                    "surface relative h-full p-7",
                    p.highlighted && "border-primary/40 shadow-glow",
                  )}
                >
                  {p.highlighted && (
                    <span className="absolute -top-2.5 left-7 rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                      Most chosen
                    </span>
                  )}
                  <h3 className="text-[15px] font-semibold">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">{p.desc}</p>
                  <p className="mt-6 flex items-end gap-1">
                    <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                    <span className="mb-1 text-[13px] text-muted-foreground">{p.period}</span>
                  </p>
                  <Button
                    asChild
                    className="mt-6 w-full rounded-full"
                    variant={p.highlighted ? "default" : "outline"}
                  >
                    <Link to="/signup">{p.cta}</Link>
                  </Button>
                  <ul className="mt-7 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[13px] text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <Reveal className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[42px]">Straight answers</h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-10">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f) => (
                <AccordionItem key={f.q} value={f.q} className="border-border">
                  <AccordionTrigger className="text-left text-[14px] font-medium hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-5 py-24">
        <Reveal className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-20 blur-3xl"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          />
          <div className="relative">
            <Flame className="mx-auto h-6 w-6 text-warning" />
            <h2 className="mt-5 text-3xl font-semibold sm:text-[42px]">
              Your next rank is a data problem.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Take the 90-minute diagnostic tonight. Wake up to a plan that knows exactly what to
              fix.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full px-8">
              <Link to="/signup">
                Start free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                The operating system for competitive exam preparation. Built in Bengaluru for every
                aspirant in India.
              </p>
              <div className="mt-5 flex gap-3 text-muted-foreground">
                <a
                  href="#"
                  aria-label="Twitter"
                  className="transition-colors hover:text-foreground"
                >
                  <Twitter className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="transition-colors hover:text-foreground"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
                <a href="#" aria-label="GitHub" className="transition-colors hover:text-foreground">
                  <Github className="h-4 w-4" />
                </a>
              </div>
            </div>
            {[
              {
                t: "Product",
                l: ["Exam DNA", "Mistake Bank", "Revision Graph", "Test Engine", "Pricing"],
              },
              { t: "Exams", l: ["JEE", "NEET", "UPSC", "GATE", "CAT", "Banking"] },
              { t: "Company", l: ["About", "Careers", "Press", "Privacy", "Terms"] },
            ].map((col) => (
              <div key={col.t}>
                <p className="text-[13px] font-semibold">{col.t}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.l.map((x) => (
                    <li key={x}>
                      <a
                        href="#"
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {x}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-[12px] text-muted-foreground sm:flex-row">
            <p>© 2026 RankOS Technologies Pvt. Ltd.</p>
            <p className="flex items-center gap-1.5">
              <ChevronDown className="h-3 w-3" /> Made for the 1.4 crore who try every year.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
