import type { Metadata, Viewport } from "next";
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
  title:       "FRC Manager — Team Management Suite",
  description: "Robot fleet, tools, inventory, procurement, budget, and schedule — all in one place.",
  manifest:    "/manifest.webmanifest",
  appleWebApp: {
    capable:          true,
    statusBarStyle:   "black-translucent",
    title:            "FRC Manager",
    startupImage:     "/apple-touch-icon.png",
  },
  icons: {
    icon:  [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "512x512" }],
  },
};

export const viewport: Viewport = {
  themeColor:          "#C1121F",
  width:               "device-width",
  initialScale:        1,
  minimumScale:        1,
  viewportFit:         "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* PWA — hide browser chrome when added to home screen */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FRC Manager" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
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
