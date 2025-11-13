import { deductCredits } from "@/actions/usage/deduct";
import { calculateCredits } from "@/components/ai-3d/CreditCalculator";
import { getSession } from "@/lib/auth/server";
import { callTencentHunyuan3DApi } from "@/lib/tencent/hunyuan-3d";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes for 3D generation

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    // Allow unauthenticated users to use the service
    // If user is logged in, we'll check credits; if not, skip credit check

    const body = await req.json();
    const {
      mode,
      provider,
      modelType,
      smartLowPoly,
      publicVisibility,
      outputFormat,
      textPrompt,
      images,
    } = body;

    // Validate required fields
    if (!mode || !provider || !modelType) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Calculate credits required
    const creditsRequired = calculateCredits({
      provider,
      mode,
      modelType,
      smartLowPoly,
    });

    // Deduct credits before generation (only if user is logged in)
    if (session?.user) {
      const deductResult = await deductCredits(
        creditsRequired,
        `AI 3D Generation: ${mode} - ${modelType}`
      );

      if (!deductResult.success) {
        return NextResponse.json(
          { error: deductResult.error || "Failed to deduct credits" },
          { status: 400 }
        );
      }
      console.log("[AI 3D API] Credits deducted:", creditsRequired);
    } else {
      console.log("[AI 3D API] User not logged in, skipping credit deduction");
    }

    // Get API keys from environment variables (.env file)
    // Support both naming conventions
    const tripoApiKey = process.env.TRIPO3D_API_KEY || process.env.Tripo_SECRET_ID;
    const tripoSecretKey = process.env.TRIPO3D_SECRET_KEY || process.env.Tripo_SECRET_KEY;
    const tencentApiKey = process.env.TENCENT_HUNYUAN_API_KEY || process.env.TENCENT_SECRET_ID;
    const tencentSecretKey = process.env.TENCENT_HUNYUAN_SECRET_KEY || process.env.TENCENT_SECRET_KEY;

    // Log API key configuration status (without exposing keys)
    console.log("[AI 3D API] Environment variables check:", {
      provider,
      hasTripoKey: !!tripoApiKey,
      hasTripoSecret: !!tripoSecretKey,
      hasTencentKey: !!tencentApiKey,
      hasTencentSecret: !!tencentSecretKey,
      // Log which env var names are being checked
      tencentKeySources: {
        TENCENT_HUNYUAN_API_KEY: !!process.env.TENCENT_HUNYUAN_API_KEY,
        TENCENT_SECRET_ID: !!process.env.TENCENT_SECRET_ID,
        TENCENT_HUNYUAN_SECRET_KEY: !!process.env.TENCENT_HUNYUAN_SECRET_KEY,
        TENCENT_SECRET_KEY: !!process.env.TENCENT_SECRET_KEY,
      },
      // Log actual values length for debugging (not the values themselves)
      tencentApiKeyLength: tencentApiKey?.length || 0,
      tencentSecretKeyLength: tencentSecretKey?.length || 0,
    });

    // Validate API keys based on provider
    if (provider === "tripo" && (!tripoApiKey || !tripoSecretKey)) {
      console.error("[AI 3D API] Tripo3D credentials are missing from .env file");
      return NextResponse.json(
        { error: "Tripo3D API credentials are not configured. Please add Tripo_SECRET_ID and Tripo_SECRET_KEY (or TRIPO3D_API_KEY and TRIPO3D_SECRET_KEY) to your .env file." },
        { status: 500 }
      );
    }

    if (provider === "tencent" && (!tencentApiKey || !tencentSecretKey)) {
      console.error("[AI 3D API] Tencent Hunyuan credentials are missing from .env file");
      return NextResponse.json(
        { error: "Tencent Hunyuan API credentials are not configured. Please add TENCENT_SECRET_ID and TENCENT_SECRET_KEY (or TENCENT_HUNYUAN_API_KEY and TENCENT_HUNYUAN_SECRET_KEY) to your .env file." },
        { status: 500 }
      );
    }

    // TODO: Call Tripo3D or Tencent Hunyuan API
    // For now, return a placeholder response
    // This should be implemented with actual API calls

    let modelUrl: string;
    let modelInfo: {
      faces: number;
      vertices: number;
      topology: string;
    };

    if (provider === "tripo") {
      // TODO: Implement Tripo3D API call
      // const tripoResponse = await callTripo3DApi({
      //   apiKey: tripoApiKey,
      //   secretKey: tripoSecretKey,
      //   mode,
      //   modelType,
      //   textPrompt,
      //   images,
      // });
      // modelUrl = tripoResponse.modelUrl;
      // modelInfo = tripoResponse.modelInfo;

      console.log("[AI 3D API] Using Tripo3D provider (placeholder)", {
        hasApiKey: !!tripoApiKey,
        hasSecretKey: !!tripoSecretKey,
      });
      // Placeholder - use default demo model
      modelUrl = "https://assets.ai3dmodel.app/pgc/ai3d-demo.glb";
      modelInfo = {
        faces: 1234,
        vertices: 567,
        topology: "Quad",
      };
    } else {
      // Call Tencent Hunyuan API
      console.log("[AI 3D API] Calling Tencent Hunyuan API", {
        mode,
        modelType,
        hasText: !!textPrompt,
        imageCount: images?.length || 0,
      });

      try {
        // Validate that API keys are not empty strings
        if (!tencentApiKey || tencentApiKey.trim() === "") {
          throw new Error("Tencent Hunyuan API Key (SecretId) is empty or not set. Please check your .env file.");
        }
        if (!tencentSecretKey || tencentSecretKey.trim() === "") {
          throw new Error("Tencent Hunyuan Secret Key is empty or not set. Please check your .env file.");
        }

        const tencentResponse = await callTencentHunyuan3DApi({
          apiKey: tencentApiKey!,
          secretKey: tencentSecretKey!,
          mode: mode as "text-to-3d" | "image-to-3d" | "multi-image-to-3d",
          modelType: modelType as "standard" | "white",
          textPrompt: textPrompt,
          images: images,
          smartLowPoly: smartLowPoly,
        });

        // If jobId is returned, task is async - return immediately for frontend polling
        if (tencentResponse.jobId) {
          console.log("[AI 3D API] Tencent Hunyuan job created:", tencentResponse.jobId);
          return NextResponse.json({
            success: true,
            jobId: tencentResponse.jobId,
            status: "processing",
            message: "3D model generation started. Please poll for status.",
          });
        }

        // If modelUrl is returned, task completed immediately
        modelUrl = tencentResponse.modelUrl;
        modelInfo = tencentResponse.modelInfo;

        console.log("[AI 3D API] Tencent Hunyuan API success:", {
          modelUrl,
          modelInfo,
        });
      } catch (error: any) {
        console.error("[AI 3D API] Tencent Hunyuan API failed:", error);
        // Return error to client
        return NextResponse.json(
          {
            error: `Failed to generate 3D model: ${error.message || "Unknown error"}`,
          },
          { status: 500 }
        );
      }
    }

    // TODO: Save model to database/user's model library if needed
    // TODO: Handle publicVisibility setting

    return NextResponse.json({
      success: true,
      modelUrl,
      modelInfo,
      creditsUsed: creditsRequired,
    });
  } catch (error: any) {
    console.error("Error generating 3D model:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

