import { Suspense } from "react";
import type { Metadata } from "next";
import AccountForm from "@/components/AccountForm";

export const metadata: Metadata = { title: "Your beginning · SwarSaarthi", description: "Create your SwarSaarthi account and start practicing Hindi at your own pace." };

export default function SignupPage() {
  return <Suspense fallback={<div className="account-page page-container"><p role="status">Preparing your space…</p></div>}><AccountForm mode="signup" /></Suspense>;
}
