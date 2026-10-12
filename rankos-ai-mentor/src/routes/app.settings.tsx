import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingsQueryOptions, updateSettings, type Settings } from "@/services/settings";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · RankOS" },
      {
        name: "description",
        content: "Appearance, notifications, privacy, language, account and security.",
      },
      { property: "og:title", content: "Settings · RankOS" },
      {
        property: "og:description",
        content: "Appearance, notifications, privacy, language, account and security.",
      },
    ],
  }),
  component: SettingsPage,
});

type ToggleGroup = "notifications" | "privacy" | "security";

const toggles: Record<
  "Notifications" | "Privacy" | "Security",
  { group: ToggleGroup; key: string; title: string; desc: string }[]
> = {
  Notifications: [
    { group: "notifications", key: "dailyPlanReminder", title: "Daily plan reminder", desc: "Every morning at 05:45" },
    { group: "notifications", key: "testReminders", title: "Test reminders", desc: "30 minutes before a scheduled mock" },
    { group: "notifications", key: "mistakeBankDigest", title: "Mistake bank digest", desc: "Weekly summary of unresolved errors" },
    { group: "notifications", key: "leaderboardMovement", title: "Leaderboard movement", desc: "When your rank changes by 5 or more" },
  ],
  Privacy: [
    { group: "privacy", key: "shareProgressWithParents", title: "Share progress with parents", desc: "Study time and subject trends only" },
    { group: "privacy", key: "appearOnPublicLeaderboards", title: "Appear on public leaderboards", desc: "Name and institute visible" },
    { group: "privacy", key: "allowAnonymisedBenchmarking", title: "Allow anonymised benchmarking", desc: "Improves percentile accuracy for everyone" },
  ],
  Security: [
    { group: "security", key: "twoFactorAuth", title: "Two-factor authentication", desc: "OTP on every new device" },
    { group: "security", key: "examLockdownMode", title: "Exam lockdown mode", desc: "Block other apps during a mock" },
    { group: "security", key: "sessionAlerts", title: "Session alerts", desc: "Email me on new sign-ins" },
  ],
};

function Row({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SettingsPage() {
  const { data } = useQuery(settingsQueryOptions());
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Settings) => updateSettings(payload),
    onSuccess: (updated) => {
      setForm(updated);
      toast.success("Settings saved.");
    },
    onError: () => toast.error("Couldn't save settings."),
  });

  const toggleValue = (group: ToggleGroup, key: string): boolean => {
    if (!form) return false;
    return Boolean((form[group] as unknown as Record<string, boolean>)[key]);
  };

  const setToggle = (group: ToggleGroup, key: string, value: boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [group]: { ...(prev[group] as object), [key]: value } } as Settings;
    });
  };

  const setAccount = (key: keyof Settings["account"], value: string) => {
    setForm((prev) => (prev ? { ...prev, account: { ...prev.account, [key]: value } } : prev));
  };

  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader
        eyebrow="Settings"
        title="Preferences"
        description="Everything here applies instantly across devices."
      />

      <Tabs defaultValue="Notifications">
        <TabsList className="rounded-full">
          {["Notifications", "Privacy", "Security", "Account"].map((t) => (
            <TabsTrigger key={t} value={t} className="rounded-full text-[12.5px]">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(toggles) as (keyof typeof toggles)[]).map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <div className="surface px-5 py-1">
              {toggles[k].map((row) => (
                <Row
                  key={row.title}
                  title={row.title}
                  desc={row.desc}
                  checked={toggleValue(row.group, row.key)}
                  onChange={(v) => setToggle(row.group, row.key, v)}
                />
              ))}
            </div>
          </TabsContent>
        ))}

        <TabsContent value="Account" className="mt-4 space-y-4">
          <div className="surface space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="n">Full name</Label>
              <Input
                id="n"
                value={form?.account.fullName ?? ""}
                onChange={(e) => setAccount("fullName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e">Email</Label>
              <Input
                id="e"
                value={form?.account.email ?? ""}
                onChange={(e) => setAccount("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l">Language</Label>
              <Input
                id="l"
                value={form?.account.language ?? ""}
                onChange={(e) => setAccount("language", e.target.value)}
              />
            </div>
            <Button
              className="rounded-xl"
              disabled={!form || save.isPending}
              onClick={() => form && save.mutate(form)}
            >
              Save changes
            </Button>
          </div>
          <div className="surface p-5">
            <p className="text-[13.5px] font-medium text-destructive">Delete account</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Permanently removes your Exam DNA, mistake history and attempts. This cannot be
              undone.
            </p>
            <Button variant="outline" className="mt-4 rounded-xl text-destructive">
              Delete my account
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
