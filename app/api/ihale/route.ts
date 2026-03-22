import { NextResponse } from "next/server";
import { runBot } from "@/lib/ihalebot";

// wichtig für Vercel (keine Edge!)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("🚀 IHALE BOT START");

    const result = await runBot();

    console.log("✅ BOT FERTIG");

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ BOT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}