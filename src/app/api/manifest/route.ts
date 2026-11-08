import { APP_ICONS, DEFAULT_APP_ICON, appIconPath, resolveAppIcon } from "@/lib/app-icons";

// Web app manifest with the device's chosen home-screen icon. The layout links to
// /api/manifest?icon=<id> (browsers fetch manifests without cookies, so the choice
// travels in the URL). Android reads these icons when the app is installed.
export function GET(req: Request) {
  const icon = resolveAppIcon(new URL(req.url).searchParams.get("icon") ?? DEFAULT_APP_ICON);
  const label = APP_ICONS.find((i) => i.id === icon)?.label;

  return Response.json(
    {
      name:             "FRC Manager",
      short_name:       "FRC Manager",
      description:      "Robot fleet, tools, inventory, orders, budget, and schedule — all in one place.",
      id:               "/dashboard",
      start_url:        "/dashboard",
      scope:            "/",
      display:          "standalone",
      // Links to the app open in the installed app where the device allows it (Android, Chrome on a computer)
      handle_links:     "preferred",
      launch_handler:   { client_mode: ["navigate-existing", "auto"] },
      background_color: "#080A10",
      theme_color:      "#080A10",
      orientation:      "portrait-primary",
      // iOS 26 takes the home-screen icon from here (no longer from the page's apple-touch-icon) — the
      // 180px one it's made for comes first; the maskable one (Android) last
      icons: [
        { src: appIconPath(icon, "apple-touch-icon.png"),  sizes: "180x180", type: "image/png", purpose: "any" },
        { src: appIconPath(icon, "icon-192.png"),          sizes: "192x192", type: "image/png", purpose: "any" },
        { src: appIconPath(icon, "icon-512.png"),          sizes: "512x512", type: "image/png", purpose: "any" },
        { src: appIconPath(icon, "icon-512-maskable.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      ...(label ? { "x-icon-style": label } : {}),
    },
    {
      headers: {
        "Content-Type":  "application/manifest+json",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
