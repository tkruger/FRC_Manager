import { redirect } from "next/navigation";

// Templates moved to /tasks/templates — kept so old links still work.
export default function OldTemplatesPage() {
  redirect("/tasks/templates");
}
