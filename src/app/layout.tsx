import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FRC Manager — Team Management Suite",
  description: "Robot fleet, tools, inventory, procurement, budget, and schedule — all in one place.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SessionProvider session={session}>
          <ThemeProvider initialMode={(session?.user?.displayMode as "LIGHT" | "DARK" | "AUTO_SYSTEM" | "AUTO_TIME") ?? "AUTO_SYSTEM"}>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
