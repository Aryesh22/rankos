import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { AuthLayout, SocialAuth } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EXAM_OPTIONS, signupSchema, type SignupValues } from "@/lib/auth-schemas";
import { ApiError } from "@/lib/api";
import { redirectIfAuthenticated } from "@/lib/auth";
import { authApi } from "@/services/auth";
import { applyFieldErrors } from "@/lib/form-errors";

export const Route = createFileRoute("/signup")({
  beforeLoad: redirectIfAuthenticated,
  head: () => ({
    meta: [
      { title: "Create your RankOS account" },
      {
        name: "description",
        content: "Start free — build your Exam DNA and get an adaptive daily plan tonight.",
      },
      { property: "og:title", content: "Create your RankOS account" },
      {
        property: "og:description",
        content: "Start free — build your Exam DNA and get an adaptive daily plan tonight.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", mobile: "", password: "", exam: "JEE" },
  });

  const mutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (result, values) => {
      toast.success("Verification code sent.");
      navigate({
        to: "/verify-otp",
        search: { userId: result.userId, mobile: values.mobile },
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && applyFieldErrors(setError, error.fields)) return;
      toast.error(error instanceof Error ? error.message : "Couldn't create your account.");
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutateAsync(values).catch(() => {}));
  const exam = watch("exam");

  return (
    <AuthLayout
      title="Start with your Exam DNA"
      subtitle="Free forever plan. No card, no counsellor call."
      footer={
        <>
          Already preparing with us?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
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
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            placeholder="Aarav Mehta"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name && <p className="text-[12px] text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input
            id="mobile"
            type="tel"
            placeholder="+91 98xxx xxxxx"
            autoComplete="tel"
            aria-invalid={Boolean(errors.mobile)}
            {...register("mobile")}
          />
          {errors.mobile && <p className="text-[12px] text-destructive">{errors.mobile.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <Input
            id="pw"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-[12px] text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Target exam</Label>
          <div className="flex flex-wrap gap-1.5">
            {EXAM_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setValue("exam", e, { shouldValidate: true })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  exam === e
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send verification code
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree to the Terms of Use and Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
}
