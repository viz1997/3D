/**
 * Tencent Hunyuan 3D API Integration
 * Documentation: https://cloud.tencent.com/document/product/1804/120838
 */

import { serverUploadFile } from "@/lib/cloudflare/r2";
import { generateR2Key } from "@/lib/cloudflare/r2-utils";
import { extractGeometryStats } from "@/lib/geometry/stats";
import AdmZip from "adm-zip";
import crypto from "crypto";

type TencentHunyuanVersion = "pro" | "rapid";

interface TencentHunyuan3DParams {
  apiKey: string;
  secretKey: string;
  mode: "text-to-3d" | "image-to-3d" | "multi-image-to-3d";
  modelType: "standard" | "white";
  textPrompt?: string;
  images?: string[]; // Base64 encoded images
  smartLowPoly?: boolean;
  version?: TencentHunyuanVersion;
  outputFormat?: string;
  faceCount?: number;
  generateType?: "Normal" | "LowPoly" | "Geometry" | "Sketch";
  polygonType?: "triangle" | "quadrilateral";
  enablePBR?: boolean;
}

interface TencentHunyuan3DResponse {
  modelUrl: string;
  modelInfo: {
    faces: number;
    vertices: number;
    topology: string;
  };
  jobId?: string; // JobId for async tasks
}

/**
 * Generate Tencent Cloud API signature using TC3-HMAC-SHA256
 * Reference: https://cloud.tencent.com/document/api/598/33159
 * Official documentation: https://cloud.tencent.com/document/product/628/35260
 */
function generateTencentSignature(
  secretKey: string,
  service: string,
  action: string,
  timestamp: number,
  region: string,
  payload: string // JSON string payload for POST requests
): string {
  // Step 1: Build canonical request string
  // According to official documentation for POST requests with JSON format
  const httpRequestMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = ""; // Empty for POST requests
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const host = service === "ai3d" ? "ai3d.tencentcloudapi.com" : "hunyuan.tencentcloudapi.com";
  const contentType = "application/json; charset=utf-8";
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";

  // HashedRequestPayload: SHA256 hash of the request payload (JSON string)
  const hashedRequestPayload = crypto
    .createHash("sha256")
    .update(payload, "utf8")
    .digest("hex")
    .toLowerCase();

  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

  // Step 2: Build string to sign
  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest, "utf8")
    .digest("hex")
    .toLowerCase();
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // Step 3: Calculate signature
  // SecretDate = HMAC_SHA256("TC3" + SecretKey, Date)
  const kDate = crypto.createHmac("sha256", `TC3${secretKey}`).update(date).digest();
  // SecretService = HMAC_SHA256(SecretDate, Service)
  const kService = crypto.createHmac("sha256", kDate).update(service).digest();
  // SecretSigning = HMAC_SHA256(SecretService, "tc3_request")
  const kSigning = crypto.createHmac("sha256", kService).update("tc3_request").digest();
  // Signature = HexEncode(HMAC_SHA256(SecretSigning, StringToSign))
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return signature;
}

/**
 * Call Tencent Hunyuan 3D API
 */
export async function callTencentHunyuan3DApi(
  params: TencentHunyuan3DParams
): Promise<TencentHunyuan3DResponse> {
  const {
    apiKey,
    secretKey,
    mode,
    modelType,
    textPrompt,
    images,
    smartLowPoly,
    version: versionOverride,
    outputFormat,
    faceCount,
    generateType,
    polygonType,
    enablePBR,
  } = params;

  // Tencent Cloud API endpoint for Hunyuan 3D
  // Official documentation: https://cloud.tencent.com/document/product/1804/120838
  // SubmitHunyuanTo3DJob API: https://cloud.tencent.com/document/product/1804/120826
  const baseUrl = "https://ai3d.tencentcloudapi.com";
  const service = "ai3d";

  const version: TencentHunyuanVersion = versionOverride ?? "pro";

  // Action name according to official documentation
  // Reference: https://cloud.tencent.com/document/product/1804/120826
  const action = version === "rapid" ? "SubmitHunyuanTo3DRapidJob" : "SubmitHunyuanTo3DProJob";

  const timestamp = Math.floor(Date.now() / 1000);
  const region = "ap-guangzhou"; // Default region
  // Generate random nonce for API signature (required by Tencent Cloud API)
  const nonce = Math.floor(Math.random() * 1000000000);

  // Prepare request payload according to official API documentation
  // Official API documentation: https://cloud.tencent.com/document/product/1804/120826
  // Correct API Version: 2025-05-13 (as per official documentation)
  // For POST requests, use JSON format according to signature method v3
  const requestPayload: Record<string, any> = {};

  // Add mode-specific parameters
  if (mode === "text-to-3d") {
    if (textPrompt) {
      requestPayload.Prompt = textPrompt;
    }
  } else if (images && images.length > 0) {
    if (mode === "multi-image-to-3d") {
      requestPayload.MultiViewImages = images
        .filter((img) => !!img)
        .map((img, index) => ({
          View: ["front", "left", "right", "back"][index] || `view_${index + 1}`,
          ImageBase64: img,
        }));
    } else {
      requestPayload.ImageBase64 = images[0];
    }
  }

  const resolvedEnablePBR = enablePBR ?? (modelType === "white" ? false : true);

  if (version === "rapid") {
    if (outputFormat) {
      requestPayload.ResultFormat = outputFormat.toUpperCase();
    }
    requestPayload.EnablePBR = resolvedEnablePBR;
  } else {
    // Pro settings
    if (faceCount) {
      requestPayload.FaceCount = faceCount;
    }
    const resolvedGenerateType = generateType
      ? generateType
      : modelType === "white"
        ? "Geometry"
        : smartLowPoly
          ? "LowPoly"
          : "Normal";
    requestPayload.GenerateType = resolvedGenerateType;
    if (smartLowPoly && !generateType) {
      requestPayload.GenerateType = "LowPoly";
    }
    if (polygonType) {
      requestPayload.PolygonType = polygonType;
    }
    requestPayload.EnablePBR = resolvedEnablePBR;
  }

  if (smartLowPoly && version === "rapid") {
    requestPayload.GenerateType = "LowPoly";
  }

  // Convert payload to JSON string
  const payloadJson = JSON.stringify(requestPayload);

  // Generate signature using JSON payload
  // According to signature method v3, signature is calculated on the JSON payload
  const signature = generateTencentSignature(
    secretKey,
    service,
    action,
    timestamp,
    region,
    payloadJson
  );

  // Validate that apiKey is provided and not empty
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Tencent Hunyuan API Key (SecretId) is missing or empty");
  }

  console.log("[Tencent Hunyuan] Calling API:", {
    action,
    mode,
    modelType,
    hasText: !!textPrompt,
    imageCount: images?.length || 0,
    region,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 4)}...` : "N/A", // Only log prefix for debugging
  });

  try {
    // Build Authorization header according to signature method v3
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const credentialScope = `${date}/${service}/tc3_request`;
    const signedHeaders = "content-type;host;x-tc-action";
    const authorization = `TC3-HMAC-SHA256 Credential=${apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Call Tencent Cloud API with JSON format (POST requests should use JSON)
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json; charset=utf-8",
        "Host": "ai3d.tencentcloudapi.com",
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp.toString(),
        "X-TC-Version": "2025-05-13",
        "X-TC-Region": region,
      },
      body: payloadJson,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Tencent Hunyuan] API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });

      // Try to parse as JSON for better error message
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.Response?.Error) {
          const error = errorJson.Response.Error;
          throw new Error(
            `Tencent Hunyuan API error (${response.status}): ${error.Code || "Unknown"} - ${error.Message || errorText}`
          );
        }
      } catch {
        // Not JSON, use raw text
      }

      throw new Error(`Tencent Hunyuan API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    // Log the full response for debugging
    console.log("[Tencent Hunyuan] API Response:", JSON.stringify(result, null, 2));

    // Check for error response
    if (result.Response?.Error) {
      const error = result.Response.Error;
      let errorMessage = `Tencent Hunyuan API error: ${error.Code || "Unknown"} - ${error.Message || "Unknown error"}`;

      // Provide helpful guidance for common errors
      if (error.Code === "AuthFailure.SecretIdNotFound") {
        errorMessage += "\n\nPlease check:\n" +
          "1. Ensure TENCENT_SECRET_ID (or TENCENT_HUNYUAN_API_KEY) is set in your .env file\n" +
          "2. Verify the SecretId is correct and belongs to your Tencent Cloud account\n" +
          "3. Make sure the SecretId has permissions for AI3D service\n" +
          "4. Check if you need to enable the AI3D service in Tencent Cloud console";
      }

      throw new Error(errorMessage);
    }

    // Handle async task - if API returns a JobId, return it immediately
    // API returns JobId (not TaskId) according to the response
    // Frontend can poll for status using the JobId
    const jobId = result.Response?.JobId || result.Response?.TaskId;
    if (jobId) {
      console.log("[Tencent Hunyuan] Job created:", jobId);
      const jobPrefix = version === "rapid" ? "tencentRapid" : "tencentPro";
      return {
        jobId: `${jobPrefix}:${jobId}`,
        modelUrl: "", // Will be set after polling
        modelInfo: {
          faces: 0,
          vertices: 0,
          topology: "Unknown",
        },
      };
    }

    // If API returns result directly
    if (result.Response?.ModelUrl || result.Response?.DownloadUrl) {
      return await processTencentHunyuanResult(result.Response);
    }

    // Log unexpected response structure
    console.error("[Tencent Hunyuan] Unexpected response structure:", {
      hasResponse: !!result.Response,
      responseKeys: result.Response ? Object.keys(result.Response) : [],
      fullResult: result,
    });

    throw new Error(
      `Unexpected API response format. Response: ${JSON.stringify(result, null, 2)}`
    );
  } catch (error: any) {
    console.error("[Tencent Hunyuan] API call failed:", error);
    throw new Error(`Failed to call Tencent Hunyuan API: ${error.message}`);
  }
}

/**
 * Query job status (for frontend polling)
 */
export async function queryTencentHunyuanJobStatus(
  apiKey: string,
  secretKey: string,
  jobId: string,
  version: TencentHunyuanVersion = "pro"
): Promise<{
  status: string;
  modelUrl?: string;
  modelInfo?: {
    faces: number;
    vertices: number;
    topology: string;
  };
  error?: string;
}> {
  const service = "ai3d";
  const action = version === "rapid" ? "QueryHunyuanTo3DRapidJob" : "QueryHunyuanTo3DProJob";
  const baseUrl = "https://ai3d.tencentcloudapi.com";
  const region = "ap-guangzhou";
  const timestamp = Math.floor(Date.now() / 1000);

  // Prepare request payload
  const requestPayload: Record<string, any> = {
    JobId: jobId,
  };

  const payloadJson = JSON.stringify(requestPayload);

  // Generate signature
  const signature = generateTencentSignature(
    secretKey,
    service,
    action,
    timestamp,
    region,
    payloadJson
  );

  // Build Authorization header
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const credentialScope = `${date}/${service}/tc3_request`;
  const signedHeaders = "content-type;host;x-tc-action";
  const authorization = `TC3-HMAC-SHA256 Credential=${apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Call API
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json; charset=utf-8",
      "Host": "ai3d.tencentcloudapi.com",
      "X-TC-Action": action,
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Version": "2025-05-13",
      "X-TC-Region": region,
    },
    body: payloadJson,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Tencent Hunyuan] Job status query failed:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(`Failed to query job: ${response.status}`);
  }

  const result = await response.json();

  // Log the full response for debugging
  console.log("[Tencent Hunyuan] Job status query response:", JSON.stringify(result, null, 2));

  // Check for error response
  if (result.Response?.Error) {
    const error = result.Response.Error;
    console.error("[Tencent Hunyuan] Job query error:", {
      code: error.Code,
      message: error.Message,
      fullError: error,
    });
    throw new Error(
      `Job query error: ${error.Code || "Unknown"} - ${error.Message || "Unknown error"}`
    );
  }

  const status = result.Response?.Status || result.Response?.JobStatus || "UNKNOWN";

  // Get model URL from ResultFile3Ds array (API returns files in this array)
  const resultFile = result.Response?.ResultFile3Ds?.[0];
  const modelUrl = resultFile?.Url || result.Response?.ModelUrl || result.Response?.DownloadUrl;

  console.log("[Tencent Hunyuan] Job status:", {
    jobId,
    status,
    hasModelUrl: !!modelUrl,
    hasResultFile3Ds: !!result.Response?.ResultFile3Ds,
    resultFileType: resultFile?.Type,
    responseKeys: result.Response ? Object.keys(result.Response) : [],
  });

  // If job is completed successfully (DONE or SUCCESS)
  if (status === "DONE" || status === "SUCCESS" || status === "succeeded" || status === "SUCCEEDED") {
    if (modelUrl) {
      // Process the result - ResultFile3Ds contains ZIP files, need to handle them
      console.log("[Tencent Hunyuan] Job completed, processing result file:", {
        type: resultFile?.Type,
        url: modelUrl,
        previewImageUrl: resultFile?.PreviewImageUrl,
      });

      // For now, return the URL directly (it's a ZIP file, may need extraction later)
      // TODO: Extract GLB/OBJ from ZIP if needed
      const processed = await processTencentHunyuanResult({
        ModelUrl: modelUrl,
        DownloadUrl: modelUrl,
        Type: resultFile?.Type,
        PreviewImageUrl: resultFile?.PreviewImageUrl,
      });

      return {
        status: "SUCCESS",
        modelUrl: processed.modelUrl,
        modelInfo: processed.modelInfo,
      };
    } else {
      // Job is done but no model URL yet, might still be processing
      console.warn("[Tencent Hunyuan] Job status is DONE but no model URL found");
      return {
        status: status,
      };
    }
  }

  // If job failed
  if (status === "FAILED" || status === "failed" || status === "FAILED") {
    return {
      status: "FAILED",
      error: result.Response?.ErrorMessage || result.Response?.Error?.Message || "Job failed",
    };
  }

  // Job is still processing (RUN, PROCESSING, etc.)
  return {
    status: status,
  };
}

/**
 * Poll for task completion (internal use, for server-side polling)
 */
async function pollTencentHunyuanTask(
  apiKey: string,
  secretKey: string,
  taskId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<any> {
  const service = "ai3d";
  const action = "QueryHunyuanTo3DJob"; // Try "DescribeHunyuanTo3DJob" if this doesn't work
  const baseUrl = "https://ai3d.tencentcloudapi.com";
  const region = "ap-guangzhou";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000);

    // Prepare request payload according to official API documentation
    // QueryHunyuanTo3DJob API: https://cloud.tencent.com/document/product/1804/120827
    // Use JSON format for POST requests
    // Note: API uses JobId (not TaskId) based on SubmitHunyuanTo3DJob response
    const requestPayload: Record<string, any> = {
      JobId: taskId, // Use JobId as parameter name (taskId variable contains the JobId value)
    };

    // Convert payload to JSON string
    const payloadJson = JSON.stringify(requestPayload);

    // Generate signature using JSON payload
    const signature = generateTencentSignature(
      secretKey,
      service,
      action,
      timestamp,
      region,
      payloadJson
    );

    // Build Authorization header according to signature method v3
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const credentialScope = `${date}/${service}/tc3_request`;
    const signedHeaders = "content-type;host;x-tc-action";
    const authorization = `TC3-HMAC-SHA256 Credential=${apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Call API with JSON format
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json; charset=utf-8",
        "Host": "ai3d.tencentcloudapi.com",
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp.toString(),
        "X-TC-Version": "2025-05-13",
        "X-TC-Region": region,
      },
      body: payloadJson,
    });

    if (!response.ok) {
      throw new Error(`Failed to query task: ${response.status}`);
    }

    const result = await response.json();

    // Log polling response for debugging
    console.log(`[Tencent Hunyuan] Task ${taskId} polling response:`, {
      status: result.Response?.Status,
      hasModelUrl: !!(result.Response?.ModelUrl || result.Response?.DownloadUrl),
      responseKeys: result.Response ? Object.keys(result.Response) : [],
    });

    // Check for error response
    if (result.Response?.Error) {
      const error = result.Response.Error;
      throw new Error(
        `Task query error: ${error.Code || "Unknown"} - ${error.Message || "Unknown error"}`
      );
    }

    if (result.Response?.Status === "SUCCESS" || result.Response?.Status === "succeeded") {
      console.log("[Tencent Hunyuan] Task completed:", taskId);
      return result.Response;
    }

    if (result.Response?.Status === "FAILED" || result.Response?.Status === "failed") {
      throw new Error(
        `Task failed: ${result.Response.ErrorMessage || result.Response?.Error?.Message || "Unknown error"}`
      );
    }

    // Task is still processing
    console.log(
      `[Tencent Hunyuan] Task ${taskId} still processing (attempt ${attempt + 1}/${maxAttempts})`
    );
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Task polling timeout");
}

/**
 * Process API result and upload model to R2
 */
async function processTencentHunyuanResult(result: any): Promise<TencentHunyuan3DResponse> {
  const modelUrl = result.ModelUrl || result.DownloadUrl;
  if (!modelUrl) {
    throw new Error("No model URL in API response");
  }

  console.log("[Tencent Hunyuan] Downloading model from:", modelUrl);
  console.log("[Tencent Hunyuan] File type:", result.Type);

  // Download the model file
  const modelResponse = await fetch(modelUrl);
  if (!modelResponse.ok) {
    throw new Error(`Failed to download model: ${modelResponse.status}`);
  }

  const modelBuffer = Buffer.from(await modelResponse.arrayBuffer());

  let finalModelBuffer: Buffer = modelBuffer;
  let fileExtension = "glb";
  let contentType = "model/gltf-binary";

  // Generate unique directory for this model (use same directory for all files)
  const timestamp = Date.now();
  const modelDir = generateR2Key({
    fileName: "",
    path: "ai-3d/models",
    prefix: "hunyuan",
  }).replace(/\/$/, "");
  const uniqueDir = `${modelDir}/${timestamp}`;

  // Check if it's a ZIP file (API returns ZIP files containing the 3D model)
  if (modelUrl.endsWith(".zip") || result.Type === "OBJ" || result.Type === "ZIP") {
    console.log("[Tencent Hunyuan] Extracting ZIP file...");
    try {
      const zip = new AdmZip(modelBuffer);
      const zipEntries = zip.getEntries();

      console.log("[Tencent Hunyuan] ZIP entries:", zipEntries.map((e: any) => e.entryName));

      // Look for GLB, OBJ, or other 3D model files
      const modelExtensions = [".glb", ".gltf", ".obj", ".fbx", ".stl"];
      let modelEntry = zipEntries.find((entry: any) =>
        modelExtensions.some(ext => entry.entryName.toLowerCase().endsWith(ext))
      );

      if (modelEntry) {
        console.log("[Tencent Hunyuan] Found model file in ZIP:", modelEntry.entryName);
        const entryData = modelEntry.getData();
        finalModelBuffer = Buffer.isBuffer(entryData) ? entryData : Buffer.from(entryData as any);

        // Determine file extension and content type
        const entryName = modelEntry.entryName.toLowerCase();
        if (entryName.endsWith(".glb")) {
          fileExtension = "glb";
          contentType = "model/gltf-binary";
        } else if (entryName.endsWith(".gltf")) {
          fileExtension = "gltf";
          contentType = "model/gltf+json";
        } else if (entryName.endsWith(".obj")) {
          fileExtension = "obj";
          contentType = "model/obj";

          // For OBJ files, extract and upload related files (MTL, textures)
          const modelBaseName = modelEntry.entryName.replace(/\.obj$/i, "");

          // Find MTL file (same name as OBJ or "material.mtl")
          const mtlEntry = zipEntries.find((entry: any) =>
            entry.entryName.toLowerCase() === `${modelBaseName.toLowerCase()}.mtl` ||
            entry.entryName.toLowerCase() === "material.mtl" ||
            entry.entryName.toLowerCase().endsWith(".mtl")
          );

          // Find texture files (PNG, JPG, etc.)
          const textureEntries = zipEntries.filter((entry: any) => {
            const name = entry.entryName.toLowerCase();
            return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
          });

          // Upload MTL file if found (using the uniqueDir generated above)
          let mtlUrl: string | undefined;
          if (mtlEntry) {
            console.log("[Tencent Hunyuan] Found MTL file:", mtlEntry.entryName);
            const mtlData = mtlEntry.getData();
            const mtlBuffer = Buffer.isBuffer(mtlData) ? mtlData : Buffer.from(mtlData as any);

            // Read and modify MTL file to update texture paths
            let mtlContent = mtlBuffer.toString("utf-8");
            // Always use "material.mtl" as the filename for consistency
            const mtlFileName = "material.mtl";

            // Update texture paths in MTL file
            textureEntries.forEach((texEntry: any) => {
              const texFileName = texEntry.entryName.split("/").pop() || "";
              const texName = texFileName.toLowerCase();
              // Replace relative paths with just the filename (they'll be in the same directory)
              const regex = new RegExp(texFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
              mtlContent = mtlContent.replace(regex, texFileName);
            });

            const mtlKey = `${uniqueDir}/${mtlFileName}`;
            const mtlUploadResult = await serverUploadFile({
              data: Buffer.from(mtlContent, "utf-8"),
              contentType: "text/plain",
              key: mtlKey,
            });
            mtlUrl = mtlUploadResult.url;
            console.log("[Tencent Hunyuan] Uploaded MTL file:", mtlUrl);
          }

          // Upload texture files
          const textureUrls: string[] = [];
          for (const texEntry of textureEntries) {
            console.log("[Tencent Hunyuan] Found texture file:", texEntry.entryName);
            const texData = texEntry.getData();
            const texBuffer = Buffer.isBuffer(texData) ? texData : Buffer.from(texData as any);
            const texFileName = texEntry.entryName.split("/").pop() || "";
            const texExt = texFileName.toLowerCase().split(".").pop() || "png";
            const texContentType = texExt === "jpg" || texExt === "jpeg" ? "image/jpeg" : "image/png";

            const texKey = `${uniqueDir}/${texFileName}`;
            const texUploadResult = await serverUploadFile({
              data: texBuffer,
              contentType: texContentType,
              key: texKey,
            });
            textureUrls.push(texUploadResult.url);
            console.log("[Tencent Hunyuan] Uploaded texture file:", texUploadResult.url);
          }

          // Modify OBJ file to update MTL path
          let objContent = finalModelBuffer.toString("utf-8");
          if (mtlUrl && mtlEntry) {
            // Always use "material.mtl" as the filename
            const mtlFileName = "material.mtl";
            // Replace mtllib path with just the filename (same directory)
            objContent = objContent.replace(/^mtllib\s+.*$/gim, `mtllib ${mtlFileName}`);
            finalModelBuffer = Buffer.from(objContent, "utf-8");
            console.log("[Tencent Hunyuan] Updated OBJ file MTL path to:", mtlFileName);
          }
        } else if (entryName.endsWith(".fbx")) {
          fileExtension = "fbx";
          contentType = "application/octet-stream";
        } else if (entryName.endsWith(".stl")) {
          fileExtension = "stl";
          contentType = "model/stl";
        }
      } else {
        // If no model file found, use the first file or throw error
        if (zipEntries.length > 0) {
          console.warn("[Tencent Hunyuan] No standard 3D model file found, using first entry:", zipEntries[0].entryName);
          const entryData = zipEntries[0].getData();
          finalModelBuffer = Buffer.isBuffer(entryData) ? entryData : Buffer.from(entryData as any);
        } else {
          throw new Error("ZIP file is empty");
        }
      }
    } catch (error) {
      console.error("[Tencent Hunyuan] Failed to extract ZIP:", error);
      throw new Error(`Failed to extract ZIP file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    // Not a ZIP file, determine extension from URL or type
    if (modelUrl.endsWith(".obj")) {
      fileExtension = "obj";
      contentType = "model/obj";
    } else if (modelUrl.endsWith(".gltf")) {
      fileExtension = "gltf";
      contentType = "model/gltf+json";
    }
  }

  // Extract geometry stats before upload
  const geometryStats = extractGeometryStats(finalModelBuffer, fileExtension);

  // Upload model file to R2 (using the uniqueDir generated above)
  const r2Key = `${uniqueDir}/model.${fileExtension}`;

  console.log("[Tencent Hunyuan] Uploading model to R2:", r2Key, "Content-Type:", contentType);

  const uploadResult = await serverUploadFile({
    data: finalModelBuffer,
    contentType: contentType,
    key: r2Key,
  });

  // Extract model info if available
  const modelInfo = {
    faces: geometryStats?.faces ?? result.Faces ?? result.faces ?? 0,
    vertices: geometryStats?.vertices ?? result.Vertices ?? result.vertices ?? 0,
    topology: result.Topology || result.topology || (result.Type ? String(result.Type) : fileExtension.toUpperCase()),
  };

  return {
    modelUrl: uploadResult.url,
    modelInfo,
  };
}

