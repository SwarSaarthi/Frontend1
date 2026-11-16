import { Suspense } from "react";
import type { Metadata } from "next";
import AccountForm from "@/components/AccountForm";

export const metadata: Metadata = { title: "Sign in · SwarSaarthi", description: "Return to your Hindi pronunciation practice and personal progress." };

export default function LoginPage() {
  return <Suspense fallback={<div className="account-page page-container"><p role="status">Preparing your space…</p></div>}><AccountForm mode="login" /></Suspense>;
}
