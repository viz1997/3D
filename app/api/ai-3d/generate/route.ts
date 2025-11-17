import { deductCredits } from "@/actions/usage/deduct";
import { calculateCredits } from "@/components/ai-3d/CreditCalculator";
import { getSession } from "@/lib/auth/server";
import { callTencentHunyuan3DApi } from "@/lib/tencent/hunyuan-3d";
import { submitTripoTask, uploadTripoImage, type TripoUploadedImage } from "@/lib/tripo/client";
import { getDataFromDataUrl } from "@/lib/url";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes for 3D generation
const GUEST_FREE_COOKIE_NAME = "guest_free_generation_used";
const GUEST_FREE_COOKIE_VALUE = "1";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    // Allow unauthenticated users to use the service
    // If user is logged in, we'll check credits; if not, skip credit check

    const guestFreeCookie = req.cookies.get(GUEST_FREE_COOKIE_NAME);
    const hasConsumedGuestFreeUse = guestFreeCookie?.value === GUEST_FREE_COOKIE_VALUE;

    // if (!session?.user && hasConsumedGuestFreeUse) {
    //   return NextResponse.json(
    //     {
    //       error: "您已使用免费生成次数，请注册登录以继续体验。",
    //     },
    //     { status: 403 }
    //   );
    // }

    const shouldMarkGuestUsage = !session?.user && !hasConsumedGuestFreeUse;
    const markGuestUsageCookie = (response: NextResponse) => {
      if (shouldMarkGuestUsage) {
        response.cookies.set(GUEST_FREE_COOKIE_NAME, GUEST_FREE_COOKIE_VALUE, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: ONE_YEAR_IN_SECONDS,
          path: "/",
        });
      }
      return response;
    };

    const body = await req.json();
    const {
      mode,
      provider,
      modelType,
      smartLowPoly,
      publicVisibility,
      outputFormat,
      modelVersion,
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
    const tripoApiKey = process.env.Tripo_SECRET_ID || process.env.TRIPO_SECRET_ID;
    const tripoSecretKey = process.env.Tripo_SECRET_KEY || process.env.TRIPO_SECRET_KEY;
    const tripoAuthToken = tripoSecretKey || tripoApiKey;
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
    if (provider === "tripo" && (!tripoApiKey && !tripoSecretKey)) {
      console.error("[AI 3D API] Tripo3D credentials are missing from .env file");
      return NextResponse.json(
        { error: "Tripo3D API credentials are not configured. Please add Tripo_SECRET_ID/TRIPO_SECRET_ID and Tripo_SECRET_KEY/TRIPO_SECRET_KEY to your .env file." },
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

    if (provider === "tripo") {
      try {
        if (!tripoAuthToken || tripoAuthToken.trim() === "") {
          throw new Error("Tripo API key is missing. Please configure Tripo_SECRET_ID/KEY (or TRIPO_SECRET_ID/KEY) in your .env file.");
        }

        const jobId = await startTripoGeneration({
          apiKey: tripoAuthToken,
          mode,
          modelType,
          textPrompt,
          images,
          outputFormat,
          smartLowPoly,
          modelVersion,
        });

        return markGuestUsageCookie(NextResponse.json({
          success: true,
          jobId,
          status: "processing",
          message: "3D model generation started. Please poll for status.",
        }));
      } catch (error: any) {
        console.error("[AI 3D API] Tripo3D API failed:", error);
        return NextResponse.json(
          {
            error: `Failed to generate 3D model: ${error.message || "Unknown Tripo error"}`,
          },
          { status: 500 }
        );
      }
    } else if (provider === "tencentPro" || provider === "tencentRapid") {
      let modelUrl: string;
      let modelInfo: {
        faces: number;
        vertices: number;
        topology: string;
      };

      const isTencentRapid = provider === "tencentRapid";
      const tencentVersion = isTencentRapid ? "rapid" : "pro";

      // Call Tencent Hunyuan API
      console.log("[AI 3D API] Calling Tencent Hunyuan API", {
        mode,
        modelType,
        hasText: !!textPrompt,
        imageCount: images?.length || 0,
        provider,
        tencentVersion,
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
          version: tencentVersion,
          outputFormat: isTencentRapid ? outputFormat : undefined,
        });

        // If jobId is returned, task is async - return immediately for frontend polling
        if (tencentResponse.jobId) {
          console.log("[AI 3D API] Tencent Hunyuan job created:", tencentResponse.jobId);
          return markGuestUsageCookie(NextResponse.json({
            success: true,
            jobId: tencentResponse.jobId,
            status: "processing",
            message: "3D model generation started. Please poll for status.",
          }));
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
    } else {
      return NextResponse.json(
        { error: "Unsupported provider" },
        { status: 400 }
      );
    }

    // If execution reaches here we already returned inside provider branches
    return NextResponse.json({
      error: "Unhandled provider response",
    }, { status: 500 });
  } catch (error: any) {
    console.error("Error generating 3D model:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function startTripoGeneration({
  apiKey,
  mode,
  modelType,
  textPrompt,
  images,
  outputFormat,
  smartLowPoly,
  modelVersion,
}: {
  apiKey: string;
  mode: string;
  modelType: string;
  textPrompt?: string;
  images?: unknown;
  outputFormat?: string;
  smartLowPoly?: boolean;
  modelVersion?: string;
}) {
  const taskType = mapTripoTaskType(mode);
  const wantsTexture = modelType !== "white";
  const payload: Record<string, any> = {
    type: taskType,
    model_version: mapTripoModelVersion(modelVersion),
    output_format: (outputFormat || "glb").toLowerCase(),
    smart_low_poly: !!smartLowPoly,
  };

  if (wantsTexture) {
    payload.texture = true;
    payload.pbr = true;
    payload.texture_quality = "standard";
  }

  if (taskType === "text_to_model") {
    if (!textPrompt || !textPrompt.trim()) {
      throw new Error("Text prompt is required for Text-to-3D generation.");
    }
    payload.prompt = textPrompt.trim().slice(0, 1024);
  } else {
    const imageList = normalizeImageData(images);
    if (imageList.length === 0) {
      throw new Error("At least one reference image is required for Image-to-3D.");
    }

    const uploadedImages = await uploadTripoImages(apiKey, imageList);

    if (taskType === "image_to_model") {
      const firstImage = uploadedImages.find((img) => !!img);
      if (!firstImage) {
        throw new Error("Failed to upload the reference image for Tripo generation.");
      }
      payload.file = {
        type: firstImage.fileType,
        file_token: firstImage.token,
      };
    } else {
      // multiview_to_model expects [front, left, back, right]
      if (!uploadedImages[0]) {
        throw new Error("Front view image is required for multi-view generation.");
      }
      const orderedFiles = buildMultiviewFiles(uploadedImages);
      payload.files = orderedFiles;
    }
  }

  const safePayload = {
    ...payload,
    file: payload.file
      ? {
        ...payload.file,
        file_token: maskToken(payload.file.file_token),
      }
      : undefined,
    files: Array.isArray(payload.files)
      ? payload.files.map((file: any) => ({
        ...file,
        file_token: maskToken(file.file_token),
      }))
      : undefined,
  };

  console.log("[AI 3D API] Tripo request payload:", {
    mode,
    taskType,
    modelType,
    smartLowPoly,
    outputFormat,
    payload: safePayload,
  });

  const tripoResponse = await submitTripoTask({
    apiKey,
    payload,
  });

  return `tripo:${tripoResponse.taskId}`;
}

function mapTripoTaskType(mode: string): "text_to_model" | "image_to_model" | "multiview_to_model" {
  switch (mode) {
    case "image-to-3d":
      return "image_to_model";
    case "multi-image-to-3d":
      return "multiview_to_model";
    default:
      return "text_to_model";
  }
}

function mapTripoModelVersion(value?: string) {
  if (!value) {
    return "v2.5-20250123";
  }

  const normalized = value.trim();
  const mapped = TRIPO_MODEL_VERSION_MAP[normalized as keyof typeof TRIPO_MODEL_VERSION_MAP];
  return mapped || normalized;
}

const TRIPO_MODEL_VERSION_MAP = {
  "3D-V3.0": "v3.0-20250812",
  "3D-V2.5": "v2.5-20250123",
  "3D-V2.0": "v2.0-20240919",
  "3D-V1.4": "v1.4-20240625",
  "3D-V1.3": "v1.3-20240522",
  "3D-V1.0": "v1.4-20240625",
  "Turbo-1.0": "Turbo-v1.0-20250506",
};

function maskToken(token?: string | null) {
  if (!token) return token;
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
}

function normalizeImageData(images: unknown): (string | null)[] {
  if (!Array.isArray(images)) {
    return [];
  }
  return images.map((item) => (typeof item === "string" && item ? item : null));
}

async function uploadTripoImages(apiKey: string, imageData: (string | null)[]): Promise<(TripoUploadedImage | undefined)[]> {
  const uploads: (TripoUploadedImage | undefined)[] = [];

  for (let index = 0; index < imageData.length; index++) {
    const dataUrl = imageData[index];

    if (!dataUrl) {
      uploads.push(undefined);
      continue;
    }

    const parsed = getDataFromDataUrl(dataUrl);
    if (!parsed) {
      throw new Error(`Invalid image data at position ${index + 1}.`);
    }

    const extension = parsed.contentType.split("/")[1] || "png";
    const uploadResult = await uploadTripoImage({
      apiKey,
      fileBuffer: parsed.buffer,
      filename: `ai3d-${Date.now()}-${index}.${extension}`,
      mimeType: parsed.contentType,
    });

    uploads.push(uploadResult);
  }

  return uploads;
}

function buildMultiviewFiles(images: (TripoUploadedImage | undefined)[]) {
  const order = [0, 2, 1, 3]; // front, left, back, right
  return order.map((sourceIndex) => {
    const image = images[sourceIndex];
    if (!image) {
      return {};
    }
    return {
      type: image.fileType,
      file_token: image.token,
    };
  });
}

