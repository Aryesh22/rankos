import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

import { AuthLayout, SocialAuth } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginValues } from "@/lib/auth-schemas";
import { ApiError } from "@/lib/api";
import { redirectIfAuthenticated, sanitizeRedirect, SESSION_QUERY_KEY } from "@/lib/auth";
import { authApi } from "@/services/auth";
import { applyFieldErrors } from "@/lib/form-errors";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: redirectIfAuthenticated,
  head: () => ({
    meta: [
      { title: "Log in · RankOS" },
      { name: "description", content: "Log in to your RankOS preparation workspace." },
      { property: "og:title", content: "Log in · RankOS" },
      { property: "og:description", content: "Log in to your RankOS preparation workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect } = Route.useSearch();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", rememberMe: true },
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, data.user);
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}.`);
      navigate({ to: sanitizeRedirect(redirect) });
    },
    onError: (error) => {
      if (error instanceof ApiError && applyFieldErrors(setError, error.fields)) return;
      toast.error(error instanceof Error ? error.message : "Couldn't sign you in.");
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutateAsync(values).catch(() => {}));
  const rememberMe = watch("rememberMe");

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Your mentor has already reviewed last night's attempt."
      footer={
        <>
          New to RankOS?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <SocialAuth />
        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="identifier">Email or mobile</Label>
          <Input
            id="identifier"
            placeholder="aarav@example.com"
            autoComplete="username"
            aria-invalid={Boolean(errors.identifier)}
            {...register("identifier")}
          />
          {errors.identifier && (
            <p className="text-[12px] text-destructive">{errors.identifier.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-[12px] text-primary hover:underline">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[12px] text-destructive">{errors.password.message}</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(v) => setValue("rememberMe", v === true)}
          />{" "}
          Keep me signed in for 30 days
        </label>

        <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue to dashboard
        </Button>
      </form>
    </AuthLayout>
  );
}
