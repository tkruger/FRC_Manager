import { auth } from "@/lib/auth";
import { tasksToCSV } from "@/lib/template-csv";
import { STANDARD_TASKS } from "@/lib/standard-template";

export async function GET() {
  const session = await auth();
  if (!session?.user?.teamId) return new Response("Unauthorized", { status: 401 });

  const csv = tasksToCSV(STANDARD_TASKS);

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="frc_standard_template.csv"',
    },
  });
}
