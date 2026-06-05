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
  const VALID_MODES = ["LIGHT", "DARK", "AUTO_SYSTEM", "AUTO_TIME"];
  const serverMode = VALID_MODES.includes(session?.user?.displayMode ?? "")
    ? session!.user.displayMode
    : "AUTO_SYSTEM";

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Blocking theme script — runs before React renders to prevent white flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
          var m=localStorage.getItem('frc-theme-mode')||'${serverMode}';
          var dark=false;
          if(m==='DARK'){dark=true;}
          else if(m==='AUTO_SYSTEM'){dark=window.matchMedia('(prefers-color-scheme: dark)').matches;}
          else if(m==='AUTO_TIME'){var h=new Date().getHours(),mo=new Date().getMonth(),s=Math.round(17+(Math.sin((mo-2)*Math.PI/6)+1)*1.5);dark=h>=s||h<6;}
          if(dark)document.documentElement.setAttribute('data-theme','dark');
          var ct=localStorage.getItem('frc-color-theme');
          if(ct&&ct!=='classic')document.documentElement.setAttribute('data-color-theme',ct);
          var bgm=localStorage.getItem('frc-bg-mode');
          if(bgm==='solid'){document.documentElement.setAttribute('data-bg-style','solid');var sc=localStorage.getItem('frc-bg-solid');if(sc)document.documentElement.style.setProperty('--bg-solid-color',sc);}
          else if(bgm==='custom'){var c1=localStorage.getItem('frc-bg-color1'),c2=localStorage.getItem('frc-bg-color2');if(c1)document.documentElement.style.setProperty('--bg-orb-1-color',c1);if(c2)document.documentElement.style.setProperty('--bg-orb-2-color',c2);}
        }catch(e){}})();` }} />
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
