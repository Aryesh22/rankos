import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { oauthUrl } from "@/services/auth";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <div
          className="pointer-events-none absolute -left-20 top-1/3 h-[420px] w-[420px] rounded-full opacity-25 blur-[120px]"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <Link to="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <p className="text-[26px] font-semibold leading-snug tracking-tight">
            “It found the 6 chapters costing me 40 marks. Nobody in two years of coaching did that.”
          </p>
          <p className="mt-5 text-sm font-medium">Ritika Sharma</p>
          <p className="text-sm text-muted-foreground">AIR 812 · JEE Advanced 2025</p>
        </div>
        <div className="relative flex gap-8 text-[13px] text-muted-foreground">
          <span>2,40,000+ aspirants</span>
          <span>1.4M attempts analysed</span>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-[380px] animate-fade-up">
          <div className="lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          <h1 className="mt-8 text-[26px] font-semibold tracking-tight lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && (
            <div className="mt-7 text-center text-[13px] text-muted-foreground">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SocialAuth() {
  const providers = [
    {
      name: "Google" as const,
      provider: "google" as const,
      path: "M12 11v2.6h6.1c-.25 1.6-1.8 4.7-6.1 4.7-3.7 0-6.7-3-6.7-6.8s3-6.8 6.7-6.8c2.1 0 3.5.9 4.3 1.6l2.9-2.8C17.3 1.9 14.9 1 12 1 5.9 1 1 5.9 1 12s4.9 11 11 11c6.4 0 10.6-4.5 10.6-10.8 0-.7-.1-1.3-.2-1.8H12z",
    },
    {
      name: "Apple" as const,
      provider: "apple" as const,
      path: "M16.4 12.9c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9s-2.1-.9-3.4-.9c-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.05 1.8-.85 3.4-.85s2 .85 3.4.82c1.4-.02 2.3-1.3 3.2-2.6.7-1 1.2-2.1 1.5-3.1-.1 0-2.9-1.1-2.9-4.1zM14 4.4c.7-.9 1.2-2.1 1.1-3.4-1 .05-2.3.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3.1-1.4z",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => {
            // Full-page redirect into the provider's OAuth consent screen.
            window.location.href = oauthUrl(p.provider);
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-elevated"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d={p.path} />
          </svg>
          {p.name}
        </button>
      ))}
    </div>
  );
}
