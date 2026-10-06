import { redirect } from "next/navigation";

// The Gantt moved to /tasks/gantt — kept so old links still work.
export default function GanttRedirect() { redirect("/tasks/gantt"); }
