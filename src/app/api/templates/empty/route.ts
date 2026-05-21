import { auth } from "@/lib/auth";
import { emptyCSV } from "@/lib/template-csv";

export async function GET() {
  const session = await auth();
  if (!session?.user?.teamId) return new Response("Unauthorized", { status: 401 });

  return new Response(emptyCSV(), {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="task_template_blank.csv"',
    },
  });
}
