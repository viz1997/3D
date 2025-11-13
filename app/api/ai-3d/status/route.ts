import { queryTencentHunyuanJobStatus } from "@/lib/tencent/hunyuan-3d";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // 1 minute for status query

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    // Get API keys from environment variables
    const tencentApiKey = process.env.TENCENT_HUNYUAN_API_KEY || process.env.TENCENT_SECRET_ID;
    const tencentSecretKey = process.env.TENCENT_HUNYUAN_SECRET_KEY || process.env.TENCENT_SECRET_KEY;

    if (!tencentApiKey || !tencentSecretKey) {
      return NextResponse.json(
        { error: "Tencent Hunyuan API credentials are not configured" },
        { status: 500 }
      );
    }

    // Query job status
    console.log("[AI 3D Status API] Querying job status:", { jobId });
    const statusResult = await queryTencentHunyuanJobStatus(
      tencentApiKey,
      tencentSecretKey,
      jobId
    );

    console.log("[AI 3D Status API] Status result:", JSON.stringify(statusResult, null, 2));

    return NextResponse.json({
      success: true,
      ...statusResult,
    });
  } catch (error: any) {
    console.error("Error querying job status:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

