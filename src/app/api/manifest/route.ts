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
      display:          "standalone",
      background_color: "#080A10",
      theme_color:      "#080A10",
      orientation:      "portrait-primary",
      icons: [
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
