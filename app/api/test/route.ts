import { runBot } from "@/lib/ihalebot";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    message: "API läuft 🚀"
  });
}