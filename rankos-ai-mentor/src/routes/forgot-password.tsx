import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, Loader2 } from "lucide-react";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth-schemas";
import { authApi } from "@/services/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password · RankOS" },
      { name: "description", content: "Send a reset link to your registered RankOS email." },
      { property: "og:title", content: "Reset your password · RankOS" },
      { property: "og:description", content: "Send a reset link to your registered RankOS email." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: authApi.forgotPassword,
    // Always render the confirmation — the endpoint returns 200 regardless of
    // whether the email exists (anti-enumeration, per API_SPEC.md).
    onSettled: () => setSentTo(getValues("email")),
  });

  const onSubmit = handleSubmit((values) => mutation.mutateAsync(values).catch(() => {}));

  return (
    <AuthLayout
      title={sentTo ? "Check your inbox" : "Reset your password"}
      subtitle={
        sentTo
          ? "We sent a secure reset link. It expires in 15 minutes."
          : "Enter the email tied to your RankOS account."
      }
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {sentTo ? (
        <div className="surface flex items-start gap-3 p-5">
          <MailCheck className="mt-0.5 h-5 w-5 text-success" />
          <div>
            <p className="text-[14px] font-medium">Link sent to {sentTo}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Didn't get it? Check spam, or{" "}
              <button onClick={() => setSentTo(null)} className="text-primary hover:underline">
                try another email
              </button>
              .
            </p>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="aarav@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && <p className="text-[12px] text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
