import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.teamId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image storage is not configured on this server." },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 8 MB." }, { status: 400 });
  }

  const ext  = file.name.split(".").pop() ?? "jpg";
  const blob = await put(
    `tools/${session.user.teamId}/${Date.now()}.${ext}`,
    file,
    { access: "public" }
  );

  return NextResponse.json({ url: blob.url });
}
