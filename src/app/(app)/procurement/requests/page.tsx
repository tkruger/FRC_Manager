import { redirect } from "next/navigation";

// The full order list lives on /procurement now.
export default function OrdersListRedirect() {
  redirect("/procurement?view=all");
}
