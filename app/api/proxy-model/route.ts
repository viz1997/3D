import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  // Validate URL format
  let modelUrl: URL;
  try {
    modelUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // Only allow http/https protocols
  if (!["http:", "https:"].includes(modelUrl.protocol)) {
    return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed" }, { status: 400 });
  }

  try {
    // Fetch the model from the external URL
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 seconds timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch model: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the model data as arrayBuffer
    const modelData = await response.arrayBuffer();

    // Determine content type from response or URL extension
    let contentType = response.headers.get("content-type");
    if (!contentType) {
      const extension = url.toLowerCase().split(".").pop();
      if (extension === "glb") {
        contentType = "model/gltf-binary";
      } else if (extension === "gltf") {
        contentType = "model/gltf+json";
      } else if (extension === "obj") {
        contentType = "model/obj";
      } else {
        contentType = "application/octet-stream";
      }
    }

    // Return the model with appropriate headers
    return new NextResponse(modelData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error proxying model:", error);
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to fetch model" }, { status: 500 });
  }
}



