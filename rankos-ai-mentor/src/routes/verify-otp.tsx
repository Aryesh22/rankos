import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ApiError } from "@/lib/api";
import { redirectIfAuthenticated, SESSION_QUERY_KEY } from "@/lib/auth";
import { authApi } from "@/services/auth";

const RESEND_SECONDS = 28;

export const Route = createFileRoute("/verify-otp")({
  // `userId` is handed over by signup; `mobile` is only for display. It's kept
  // optional here so a direct visit degrades to a redirect (below) rather than a
  // hard search-validation error.
  validateSearch: z.object({
    userId: z.string().optional(),
    mobile: z.string().optional(),
  }),
  beforeLoad: async (args) => {
    await redirectIfAuthenticated(args);
    if (!args.search.userId) {
      throw redirect({ to: "/signup" });
    }
  },
  head: () => ({
    meta: [
      { title: "Verify your number · RankOS" },
      {
        name: "description",
        content: "Enter the 6-digit code sent to your mobile to finish signup.",
      },
      { property: "og:title", content: "Verify your number · RankOS" },
      {
        property: "og:description",
        content: "Enter the 6-digit code sent to your mobile to finish signup.",
      },
    ],
  }),
  component: OtpPage,
});

function maskMobile(mobile?: string) {
  if (!mobile) return "your mobile";
  const digits = mobile.replace(/\D/g, "");
  if (digits.length < 4) return mobile;
  return `••• ••• ${digits.slice(-4)}`;
}

function OtpPage() {
  const search = Route.useSearch();
  // `beforeLoad` guarantees `userId` is present before this component renders.
  const userId = search.userId ?? "";
  const mobile = search.mobile;
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (seconds === 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = useMutation({
    mutationFn: () => authApi.verifyOtp({ userId, code }),
    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, data.user);
      toast.success("Verified. Building your plan…");
      navigate({ to: "/app" });
    },
    onError: (error) => {
      setCode("");
      toast.error(error instanceof ApiError ? error.message : "That code didn't work.");
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendOtp({ userId }),
    onSuccess: () => {
      setSeconds(RESEND_SECONDS);
      toast.success("A new code is on the way.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't resend the code.");
    },
  });

  return (
    <AuthLayout
      title="Verify your number"
      subtitle={`We sent a 6-digit code to ${maskMobile(mobile)}.`}
      footer={
        seconds > 0 ? (
          <span>Resend code in 00:{String(seconds).padStart(2, "0")}</span>
        ) : (
          <button
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="font-medium text-primary hover:underline disabled:opacity-60"
          >
            {resend.isPending ? "Sending…" : "Resend code"}
          </button>
        )
      }
    >
      <div className="space-y-6">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={() => verify.mutate()}
          disabled={verify.isPending}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        <Button
          className="w-full rounded-xl"
          disabled={code.length !== 6 || verify.isPending}
          onClick={() => verify.mutate()}
        >
          {verify.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify and build my plan
        </Button>
      </div>
    </AuthLayout>
  );
}
