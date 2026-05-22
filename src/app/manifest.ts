import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "FRC Manager",
    short_name:       "FRC Manager",
    description:      "Robot fleet, tools, inventory, procurement, budget, and schedule — all in one place.",
    start_url:        "/dashboard",
    display:          "standalone",
    background_color: "#080A10",
    theme_color:      "#C1121F",
    orientation:      "portrait-primary",
    icons: [
      {
        src:     "/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",
      },
    ],
  };
}
