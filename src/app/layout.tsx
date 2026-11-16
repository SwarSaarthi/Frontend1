import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteShell } from "@/components/SiteShell";
import { NavigationTransition } from "@/components/NavigationTransition";
import "./globals.css";

const jakarta = localFont({ src: "../../public/fonts/PlusJakartaSans-Variable.ttf", variable: "--font-jakarta", display: "swap" });
const hindi = localFont({ src: "../../public/fonts/NotoSansDevanagari-Variable.ttf", variable: "--font-hindi", display: "swap", preload: false });
export const metadata: Metadata = {
  title: { default: "SwarSaarthi — A little closer to your voice", template: "%s · SwarSaarthi" },
  description: "A calmer way to practise Hindi speech. Listen, speak, and build confidence with a personal pronunciation companion, one word at a time.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={`${jakarta.variable} ${hindi.variable}`}><AuthProvider><NavigationTransition><SiteShell>{children}</SiteShell></NavigationTransition></AuthProvider></body></html>;
}
