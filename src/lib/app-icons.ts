// Home-screen icon choices (files in /public/app-icons/<id>/). Client-safe.
//
// iOS and Android read the icon when the app is added to the home screen, so a new
// choice only takes effect after removing the app and adding it again. The choice is
// per device, kept in a cookie the layout and manifest read.

export const APP_ICONS = [
  { id: "06_lineart_orange",             label: "Line art — orange" },
  { id: "01_fullcolor_charcoal",         label: "Full colour — charcoal" },
  { id: "02_fullcolor_orange",           label: "Full colour — orange" },
  { id: "03_silhouette_black_on_orange", label: "Silhouette — black on orange" },
  { id: "04_stencil_orange_on_black",    label: "Stencil — orange on black" },
  { id: "05_duotone_orange",             label: "Duotone — orange" },
  { id: "07_silhouette_white_on_orange", label: "Silhouette — white on orange" },
  { id: "08_front_closeup",              label: "Front close-up" },
  { id: "09_red_bumpers_charcoal",       label: "Red bumpers — charcoal" },
  { id: "10_red_bumpers_studio",         label: "Red bumpers — studio" },
  { id: "11_blue_bumpers_charcoal",      label: "Blue bumpers — charcoal" },
  { id: "12_blue_bumpers_studio",        label: "Blue bumpers — studio" },
] as const;

export type AppIconId = (typeof APP_ICONS)[number]["id"];

export const DEFAULT_APP_ICON: AppIconId = "06_lineart_orange";
export const APP_ICON_COOKIE = "frc-app-icon";

export function resolveAppIcon(value: string | null | undefined): AppIconId {
  return APP_ICONS.some((i) => i.id === value) ? (value as AppIconId) : DEFAULT_APP_ICON;
}

export function appIconPath(id: AppIconId, file: "apple-touch-icon.png" | "icon-192.png" | "icon-512.png" | "icon-512-maskable.png") {
  return `/app-icons/${id}/${file}`;
}
