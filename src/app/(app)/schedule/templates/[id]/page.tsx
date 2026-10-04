import { redirect } from "next/navigation";

// Templates moved to /tasks/templates — kept so old links still work.
export default async function OldTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/tasks/templates/${id}`);
}
