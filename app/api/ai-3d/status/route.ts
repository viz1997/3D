import { queryTencentHunyuanJobStatus } from "@/lib/tencent/hunyuan-3d";
import { processTripoModel, queryTripoTaskStatus } from "@/lib/tripo/client";
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

    const parsedJob = parseJobId(jobId);

    if (parsedJob.provider === "tripo") {
      const tripoApiKey = process.env.Tripo_SECRET_ID || process.env.TRIPO_SECRET_ID;
      const tripoSecretKey = process.env.Tripo_SECRET_KEY || process.env.TRIPO_SECRET_KEY;
      const tripoAuthToken = tripoSecretKey || tripoApiKey;
      if (!tripoAuthToken) {
        return NextResponse.json(
          { error: "Tripo3D API credentials are not configured" },
          { status: 500 }
        );
      }

      console.log("[AI 3D Status API] Querying Tripo task", { jobId: parsedJob.id });
      const tripoStatus = await queryTripoTaskStatus(tripoAuthToken, parsedJob.id);

      if (isTripoSuccess(tripoStatus.status) && tripoStatus.modelUrl) {
        const processed = await processTripoModel(tripoStatus.modelUrl);
        return NextResponse.json({
          success: true,
          status: "SUCCESS",
          modelUrl: processed.modelUrl,
          modelInfo: processed.modelInfo,
        });
      }

      if (isTripoFailed(tripoStatus.status)) {
        return NextResponse.json({
          success: true,
          status: "FAILED",
          error: tripoStatus.error || "Tripo task failed",
        });
      }

      return NextResponse.json({
        success: true,
        status: "PROCESSING",
      });
    }

    // Tencent fallback
    const tencentApiKey = process.env.TENCENT_HUNYUAN_API_KEY || process.env.TENCENT_SECRET_ID;
    const tencentSecretKey = process.env.TENCENT_HUNYUAN_SECRET_KEY || process.env.TENCENT_SECRET_KEY;

    if (!tencentApiKey || !tencentSecretKey) {
      return NextResponse.json(
        { error: "Tencent Hunyuan API credentials are not configured" },
        { status: 500 }
      );
    }

    const isTencentRapid = parsedJob.provider === "tencent-rapid";
    const tencentVersion = isTencentRapid ? "rapid" : "pro";
    const tencentJobId = parsedJob.id;

    console.log("[AI 3D Status API] Querying Tencent job", { jobId: tencentJobId });
    const statusResult = await queryTencentHunyuanJobStatus(
      tencentApiKey,
      tencentSecretKey,
      tencentJobId,
      tencentVersion
    );

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

function parseJobId(jobId: string): { provider: "tripo" | "tencent-pro" | "tencent-rapid" | "unknown"; id: string } {
  if (jobId.startsWith("tripo:")) {
    return { provider: "tripo", id: jobId.replace(/^tripo:/, "") };
  }
  if (jobId.startsWith("tencentRapid:")) {
    return { provider: "tencent-rapid", id: jobId.replace(/^tencentRapid:/, "") };
  }
  if (jobId.startsWith("tencentPro:")) {
    return { provider: "tencent-pro", id: jobId.replace(/^tencentPro:/, "") };
  }
  if (jobId.startsWith("tencent:")) {
    return { provider: "tencent-pro", id: jobId.replace(/^tencent:/, "") };
  }
  return { provider: "unknown", id: jobId };
}

function isTripoSuccess(status: string) {
  const normalized = status?.toLowerCase();
  return normalized === "completed" || normalized === "success";
}

function isTripoFailed(status: string) {
  const normalized = status?.toLowerCase();
  return normalized === "failed" || normalized === "rejected" || normalized === "error";
}

