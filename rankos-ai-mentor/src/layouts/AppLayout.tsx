import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  Brain,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  User,
  X,
  AlertTriangle,
  ChevronsUpDown,
  Flame,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { AiChatDock } from "@/components/app/AiChatDock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth, useLogout } from "@/lib/auth";
import type { Role } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
  /** When set, only these roles see the item. */
  roles?: Role[];
}

const nav: { group: string; items: NavItem[] }[] = [
  {
    group: "Prepare",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/planner", label: "AI Planner", icon: CalendarRange },
      { to: "/app/revision-graph", label: "Revision Graph", icon: Network },
    ],
  },
  {
    group: "Perform",
    items: [
      { to: "/app/tests", label: "Tests", icon: GraduationCap },
      { to: "/app/results", label: "Result Analysis", icon: BarChart3 },
      { to: "/app/exam-dna", label: "Exam DNA", icon: Brain },
      { to: "/app/mistakes", label: "Mistake Bank", icon: AlertTriangle },
    ],
  },
  {
    group: "Community",
    items: [
      { to: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
      { to: "/app/profile", label: "Profile", icon: User },
    ],
  },
  {
    group: "Workspaces",
    items: [
      {
        to: "/app/parent",
        label: "Parent View",
        icon: ShieldCheck,
        roles: ["parent", "admin", "student"],
      },
      { to: "/app/teacher", label: "Teacher View", icon: Bot, roles: ["teacher", "admin"] },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const logout = useLogout();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  // Hide role-restricted workspaces until the session resolves the user's role.
  const canSee = (item: NavItem) => !item.roles || (user ? item.roles.includes(user.role) : false);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/">
            <Logo />
          </Link>
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3">
          <div className="surface flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1">Search…</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {nav.map((section) => {
            const items = section.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={section.group}>
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isActive(item.to, item.exact);
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                          )}
                        >
                          <item.icon
                            className={cn("h-4 w-4", active ? "text-primary" : "")}
                            strokeWidth={1.75}
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-gradient text-[11px] font-semibold text-primary-foreground">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{user.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{user.examLabel}</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-warning/12 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                    <Flame className="h-3 w-3" />
                    {user.streak}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/app/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={logout.isPending}
                  onSelect={(e) => {
                    e.preventDefault();
                    logout.mutate();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          )}
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-[248px]">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            AI mentor synced 2 min ago
          </div>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/test/$testId" params={{ testId: "pt-07" }}>
              Start today's test
            </Link>
          </Button>
        </header>

        <main className="px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <AiChatDock />
    </div>
  );
}
