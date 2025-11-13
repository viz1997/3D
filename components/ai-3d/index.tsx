"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUserBenefits } from "@/hooks/useUserBenefits";
import { cn } from "@/lib/utils";
import { Crown, HelpCircle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { calculateCredits, type GenerationParams } from "./CreditCalculator";
import Model3DViewer from "./Model3DViewer";
import { UploadArea } from "./UploadArea";

export default function AI3DInteraction() {
  const t = useTranslations("AI3D");
  const { benefits, isLoading: isLoadingBenefits, isError: benefitsError } = useUserBenefits();
  const isPro =
    benefits?.subscriptionStatus === "active" ||
    benefits?.subscriptionStatus === "trialing";

  const [mainTab, setMainTab] = useState<"text-to-3d" | "image-to-3d">(
    "text-to-3d"
  );
  const [imageTab, setImageTab] = useState<"single" | "multiple">("single");
  const [selectedModel, setSelectedModel] = useState("3D-V3.0");
  const [provider, setProvider] = useState<"tripo" | "tencent">("tripo");
  const [modelType, setModelType] = useState<"standard" | "white">("standard");
  const [smartLowPoly, setSmartLowPoly] = useState(false);
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [outputFormat, setOutputFormat] = useState("GLB");
  const [textPrompt, setTextPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [currentJobId, setCurrentJobId] = useState<string>();
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string>();
  const [generatedModelInfo, setGeneratedModelInfo] = useState<{
    faces?: number;
    vertices?: number;
    topology?: string;
  }>();
  const [currentGenerationParams, setCurrentGenerationParams] = useState<{
    mode?: string;
    provider?: string;
    modelType?: string;
    smartLowPoly?: boolean;
  }>();

  // LocalStorage key for saving task state
  const TASK_STORAGE_KEY = "ai3d_current_task";

  // Save task state to localStorage
  const saveTaskState = (
    jobId?: string,
    status?: "idle" | "processing" | "completed" | "failed",
    modelUrl?: string,
    modelInfo?: { faces?: number; vertices?: number; topology?: string }
  ) => {
    try {
      const taskState = {
        jobId: jobId || currentJobId,
        status: status || generationStatus,
        modelUrl: modelUrl || generatedModelUrl,
        modelInfo: modelInfo || generatedModelInfo,
        generationParams: currentGenerationParams,
        timestamp: Date.now(),
      };
      console.log("[AI3D] Saving task state:", taskState);
      localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskState));
    } catch (error) {
      console.error("[AI3D] Failed to save task to localStorage:", error);
    }
  };

  // Clear task state from localStorage
  const clearTaskState = () => {
    try {
      localStorage.removeItem(TASK_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear task from localStorage:", error);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 120; // 10 minutes (5 seconds * 120)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch("/api/ai-3d/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });

        if (!response.ok) {
          throw new Error("Failed to query job status");
        }

        const data = await response.json();

        if (data.status === "SUCCESS" && data.modelUrl) {
          // Job completed successfully
          setGeneratedModelUrl(data.modelUrl);
          setGeneratedModelInfo(data.modelInfo);
          setGenerationStatus("completed");
          setIsGenerating(false);

          // Save completed task state to localStorage (use explicit values)
          const taskState = {
            jobId: jobId,
            status: "completed" as const,
            modelUrl: data.modelUrl,
            modelInfo: data.modelInfo,
            generationParams: currentGenerationParams,
            timestamp: Date.now(),
          };
          console.log("[AI3D] Saving completed task state:", taskState);
          localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskState));

          toast.success(t("generationSuccess"));
        } else if (data.status === "FAILED") {
          // Job failed
          setGenerationStatus("failed");
          setIsGenerating(false);

          // Save failed task state to localStorage
          saveTaskState(jobId, "failed");

          toast.error(data.error || t("generationError"));
        } else {
          // Job still processing
          attempts++;

          // Update task state in localStorage (still processing)
          saveTaskState(jobId, "processing");

          if (attempts >= maxAttempts) {
            setGenerationStatus("failed");
            setIsGenerating(false);

            // Save failed task state to localStorage
            saveTaskState(jobId, "failed");

            toast.error("Generation timeout. Please try again.");
          } else {
            // Continue polling after 5 seconds
            setTimeout(poll, 5000);
          }
        }
      } catch (error) {
        attempts++;

        // Update task state in localStorage (still processing, but with error)
        saveTaskState(jobId, "processing");

        if (attempts >= maxAttempts) {
          setGenerationStatus("failed");
          setIsGenerating(false);

          // Save failed task state to localStorage
          saveTaskState(jobId, "failed");

          toast.error("Failed to check generation status");
        } else {
          // Retry after 5 seconds
          setTimeout(poll, 5000);
        }
      }
    };

    // Start polling
    poll();
  };

  // Load task state from localStorage on mount
  useEffect(() => {
    try {
      const savedTask = localStorage.getItem(TASK_STORAGE_KEY);
      console.log("[AI3D] Loading task from localStorage:", savedTask);

      if (savedTask) {
        const task = JSON.parse(savedTask);
        const { jobId, status, modelUrl, modelInfo, generationParams, timestamp } = task;

        console.log("[AI3D] Restored task:", { jobId, status, modelUrl, modelInfo, generationParams, timestamp });

        // Check if task is recent (within 24 hours)
        const taskAge = Date.now() - (timestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (taskAge < maxAge) {
          // Restore task state
          if (jobId) {
            setCurrentJobId(jobId);
          }
          if (generationParams) {
            setCurrentGenerationParams(generationParams);
          }

          if (status === "completed" && modelUrl) {
            // Task was completed, restore results
            console.log("[AI3D] Restoring completed model:", modelUrl);
            setGeneratedModelUrl(modelUrl);
            setGeneratedModelInfo(modelInfo);
            setGenerationStatus("completed");
            setIsGenerating(false);
            toast.success(t("generationSuccess") || "任务已完成");
          } else if (status === "processing" && jobId) {
            // Task was in progress, resume polling
            console.log("[AI3D] Resuming polling for job:", jobId);
            setGenerationStatus("processing");
            setIsGenerating(true);
            toast.info("恢复任务进度...");
            pollJobStatus(jobId);
          } else if (status === "failed") {
            // Task failed, restore failed state
            console.log("[AI3D] Task failed");
            setGenerationStatus("failed");
            setIsGenerating(false);
          } else {
            console.log("[AI3D] Task status unknown or missing modelUrl:", { status, modelUrl });
          }
        } else {
          // Task is too old, clear it
          console.log("[AI3D] Task too old, clearing:", taskAge, "ms");
          localStorage.removeItem(TASK_STORAGE_KEY);
        }
      } else {
        console.log("[AI3D] No saved task found");
      }
    } catch (error) {
      console.error("[AI3D] Failed to load task from localStorage:", error);
      localStorage.removeItem(TASK_STORAGE_KEY);
    }
  }, []); // Only run on mount

  const handleFileUpload = (file: File, index?: number) => {
    if (index !== undefined) {
      const newFiles = [...uploadedFiles];
      newFiles[index] = file;
      setUploadedFiles(newFiles);
    } else {
      setUploadedFiles([file]);
    }
  };

  const handleSmartLowPolyChange = (checked: boolean) => {
    if (checked && !isPro) {
      toast.error(t("upgradeProRequired"));
      return;
    }
    setSmartLowPoly(checked);
  };

  const handlePublicVisibilityChange = (checked: boolean) => {
    if (!checked && !isPro) {
      toast.error(t("upgradeProRequired"));
      setPublicVisibility(true);
      return;
    }
    setPublicVisibility(checked);
  };

  const getGenerationMode = (): GenerationParams["mode"] => {
    if (mainTab === "text-to-3d") return "text-to-3d";
    if (imageTab === "single") return "image-to-3d";
    return "multi-image-to-3d";
  };

  const generationParams: GenerationParams = {
    provider,
    mode: getGenerationMode(),
    modelType,
    smartLowPoly,
  };

  const requiredCredits = calculateCredits(generationParams);

  const canGenerate = () => {
    if (mainTab === "text-to-3d") {
      return textPrompt.trim().length > 0;
    }
    if (imageTab === "single") {
      return uploadedFiles.length > 0;
    }
    return uploadedFiles[0] !== undefined; // Front view required
  };

  const handleCreate = async () => {
    if (!canGenerate()) {
      toast.error(t("fillRequiredFields"));
      return;
    }

    // Check if benefits are still loading (only if user is logged in)
    if (isLoadingBenefits) {
      toast.error("Loading user benefits, please wait...");
      return;
    }

    // Check if benefits failed to load
    if (benefitsError) {
      toast.error("Failed to load user benefits. Please refresh the page.");
      return;
    }

    // Check if benefits are loaded (only if user is logged in)
    // If user is not logged in, benefits will be undefined, skip credit check
    if (benefits) {
      const availableCredits = benefits.totalAvailableCredits ?? 0;
      if (availableCredits < requiredCredits) {
        toast.error(
          `${t("insufficientCredits")}. ${t("requiredCredits")}: ${requiredCredits}, ${t("availableCredits")}: ${availableCredits}`
        );
        return;
      }
    }

    setIsGenerating(true);
    try {
      // TODO: Call API to generate 3D model
      // Convert files to base64 for API
      const imageData =
        mainTab === "image-to-3d"
          ? await Promise.all(
            uploadedFiles.map((file) => {
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () =>
                  resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
            })
          )
          : undefined;

      const response = await fetch("/api/ai-3d/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: getGenerationMode(),
          provider,
          modelType,
          smartLowPoly,
          publicVisibility,
          outputFormat,
          textPrompt: mainTab === "text-to-3d" ? textPrompt : undefined,
          images: imageData,
        }),
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = t("generationError");
        try {
          const errorData = await response.json();
          if (errorData.error) {
            // Check if it's an insufficient credits error
            if (
              errorData.error.toLowerCase().includes("insufficient") ||
              errorData.error.toLowerCase().includes("credits")
            ) {
              errorMessage = `${t("insufficientCredits")}. ${t("requiredCredits")}: ${requiredCredits}`;
            } else {
              errorMessage = errorData.error;
            }
          }
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Check if response contains jobId (async task)
      if (data.jobId) {
        setCurrentJobId(data.jobId);
        setGenerationStatus("processing");
        // Keep isGenerating true to show "generating" button state
        // setIsGenerating will be set to false in pollJobStatus when done
        toast.success(t("generationStarted"));
        const params = {
          mode: getGenerationMode(),
          provider,
          modelType,
          smartLowPoly,
        };
        setCurrentGenerationParams(params);

        // Save task state to localStorage
        saveTaskState(data.jobId, "processing");

        // Start polling for job status
        pollJobStatus(data.jobId);
      } else if (data.modelUrl) {
        // Synchronous response - model is ready immediately
        setGeneratedModelUrl(data.modelUrl);
        setGeneratedModelInfo(data.modelInfo);
        setGenerationStatus("completed");
        const params = {
          mode: getGenerationMode(),
          provider,
          modelType,
          smartLowPoly,
        };
        setCurrentGenerationParams(params);

        // Save completed task state to localStorage (use explicit values)
        const taskState = {
          jobId: undefined,
          status: "completed" as const,
          modelUrl: data.modelUrl,
          modelInfo: data.modelInfo,
          generationParams: params,
          timestamp: Date.now(),
        };
        console.log("[AI3D] Saving completed task state (sync):", taskState);
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskState));

        toast.success(t("generationSuccess"));
        setIsGenerating(false);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("generationError");
      toast.error(errorMessage);
      setGenerationStatus("failed");
      setIsGenerating(false);

      // Save failed task state to localStorage
      saveTaskState(undefined, "failed");
    }
  };

  return (
    <div className="flex-1 w-full bg-[#0f1419] text-white flex overflow-hidden">
      {/* Left Panel - Interaction Area (1/3) */}
      <div className="w-1/3 border-r border-[#1f2937] overflow-y-auto h-full">
        <div className="p-6 space-y-5">
          {/* Main Tabs */}
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-5 bg-[#1a1f2e] p-1 rounded-lg">
              <TabsTrigger
                value="text-to-3d"
                className="data-[state=active]:bg-[#2d3548] rounded-md text-gray-400 data-[state=active]:text-white"
              >
                {t("textTo3D")}
              </TabsTrigger>
              <TabsTrigger
                value="image-to-3d"
                className="data-[state=active]:bg-[#2d3548] rounded-md text-gray-400 data-[state=active]:text-white"
              >
                {t("imageTo3D")}
              </TabsTrigger>
            </TabsList>

            {/* Text to 3D Tab */}
            <TabsContent value="text-to-3d" className="space-y-4 min-h-[320px]">
              <div>
                <Textarea
                  id="text-prompt"
                  placeholder={t("promptPlaceholder")}
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  className="min-h-[120px] bg-[#1a1f2e] border-[#2d3548] text-white placeholder:text-gray-500 resize-none focus:border-[#4a5568]"
                />
              </div>
            </TabsContent>

            {/* Image to 3D Tab */}
            <TabsContent value="image-to-3d" className="space-y-4 min-h-[320px]">
              {/* Image Sub-tabs */}
              <div className="flex items-center gap-6 mb-4 border-b border-[#2d3548]">
                <button
                  onClick={() => setImageTab("single")}
                  className={cn(
                    "pb-2 border-b-2 transition-colors text-sm",
                    imageTab === "single"
                      ? "border-white text-white"
                      : "border-transparent text-gray-400 hover:text-gray-300"
                  )}
                >
                  {t("singleImage")}
                </button>
                <button
                  onClick={() => setImageTab("multiple")}
                  className={cn(
                    "pb-2 border-b-2 transition-colors flex items-center gap-1.5 text-sm",
                    imageTab === "multiple"
                      ? "border-white text-white"
                      : "border-transparent text-gray-400 hover:text-gray-300"
                  )}
                >
                  {t("multipleImages")}
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Single Image Upload */}
              {imageTab === "single" && (
                <div>
                  <UploadArea
                    label={t("uploadImage")}
                    size="medium"
                    onUpload={(file) => handleFileUpload(file)}
                  />
                  <p className="text-gray-500 text-xs text-center mt-3">
                    {t("imageFormatHint")}
                  </p>
                </div>
              )}

              {/* Multiple Images Upload */}
              {imageTab === "multiple" && (
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <UploadArea
                      label={t("frontView")}
                      required
                      size="small"
                      onUpload={(file) => handleFileUpload(file, 0)}
                    />
                    <UploadArea
                      label={t("backView")}
                      size="small"
                      onUpload={(file) => handleFileUpload(file, 1)}
                    />
                    <UploadArea
                      label={t("leftView")}
                      size="small"
                      onUpload={(file) => handleFileUpload(file, 2)}
                    />
                    <UploadArea
                      label={t("rightView")}
                      size="small"
                      onUpload={(file) => handleFileUpload(file, 3)}
                    />
                  </div>
                  <div className="flex items-start gap-2 mt-3 text-gray-500 text-xs">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>{t("frontViewRequired")}</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Provider Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm text-gray-300">{t("selectProvider")}</Label>
              <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as "tripo" | "tencent")}
            >
              <SelectTrigger className="w-full bg-[#1a1f2e] border-[#2d3548] text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tripo">Tripo 3D-V3.0</SelectItem>
                <SelectItem value="tencent">
                  {t("tencentHunyuanPro")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model Type Selection */}
          <div className="space-y-2.5">
            <Label className="text-sm text-gray-300">{t("modelSelection")}</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setModelType("standard")}
                className={cn(
                  "px-3 py-2 rounded-md border transition-all text-sm",
                  modelType === "standard"
                    ? "border-blue-500 bg-[#1a1f2e] text-white"
                    : "border-[#2d3548] bg-[#1a1f2e]/50 text-gray-400 hover:border-[#3d4558]"
                )}
              >
                {t("standardTexture")}
              </button>
              <button
                onClick={() => setModelType("white")}
                className={cn(
                  "px-3 py-2 rounded-md border transition-all text-sm",
                  modelType === "white"
                    ? "border-blue-500 bg-[#1a1f2e] text-white"
                    : "border-[#2d3548] bg-[#1a1f2e]/50 text-gray-400 hover:border-[#3d4558]"
                )}
              >
                {t("whiteModel")}
              </button>
            </div>
          </div>

          {/* Smart Low Poly Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="smart-low-poly"
                  className="cursor-pointer text-sm text-gray-300"
                >
                  {t("smartLowPoly")}
                </Label>
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <Switch
                id="smart-low-poly"
                checked={smartLowPoly}
                onCheckedChange={handleSmartLowPolyChange}
              />
            </div>

            {/* Public Visibility */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="public-visibility"
                  className="cursor-pointer text-sm text-gray-300"
                >
                  {t("publicVisibility")}
                </Label>
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <Switch
                id="public-visibility"
                checked={publicVisibility}
                onCheckedChange={handlePublicVisibilityChange}
              />
            </div>
          </div>

          {/* Output Format */}
          <div className="flex items-center justify-between">
            <Label className="text-sm text-gray-300">{t("outputFormat")}</Label>
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger className="w-24 bg-[#1a1f2e] border-[#2d3548] text-sm h-8 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GLB">GLB</SelectItem>
                <SelectItem value="OBJ">OBJ</SelectItem>
                <SelectItem value="STL">STL</SelectItem>
                <SelectItem value="FBX">FBX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Credit Cost Display */}
          <div className="bg-[#1a1f2e] rounded-lg p-3 border border-[#2d3548]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t("requiredCredits")}</span>
              <span className="text-lg font-semibold text-white">
                {requiredCredits}
              </span>
            </div>
            {benefits && (
              <div className="text-xs text-gray-500 mt-1">
                {t("availableCredits")}: {benefits.totalAvailableCredits ?? 0}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            className="w-full bg-white hover:bg-gray-200 text-black py-5 mt-6"
            size="lg"
            onClick={handleCreate}
            disabled={
              isGenerating ||
              !canGenerate() ||
              isLoadingBenefits
            }
          >
            {isGenerating
              ? t("generating")
              : isLoadingBenefits
                ? "Loading..."
                : t("create")}
          </Button>
        </div>
      </div>

      {/* Right Panel - 3D Preview Area (2/3) */}
      <div className="w-2/3 h-full">
        <Model3DViewer
          modelUrl={generatedModelUrl}
          autoRotate={true}
          showInfo={!!generatedModelUrl}
          showControls={!!generatedModelUrl}
          modelInfo={generatedModelInfo}
          generationParams={currentGenerationParams}
          generationStatus={generationStatus}
          className="h-full w-full"
        />
        {/* Debug info */}
        {process.env.NODE_ENV === "development" && (
          <div className="absolute bottom-0 left-0 p-2 bg-black/50 text-xs text-white z-50">
            Debug: modelUrl={generatedModelUrl ? "✓" : "✗"}, status={generationStatus}
          </div>
        )}
      </div>
    </div>
  );
}

