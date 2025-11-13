"use client";

import { calculateCredits, type GenerationParams } from "@/components/ai-3d/CreditCalculator";
import { UploadArea } from "@/components/ai-3d/UploadArea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUserBenefits } from "@/hooks/useUserBenefits";
import { Sparkles, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

interface InlineGeneratorProps {
  onModelGenerated?: (modelUrl: string, modelInfo?: {
    faces?: number;
    vertices?: number;
    topology?: string;
  }) => void;
}

export default function InlineGenerator({ onModelGenerated }: InlineGeneratorProps) {
  const t = useTranslations("AI3D");
  const { benefits, isLoading: isLoadingBenefits } = useUserBenefits();

  const [mode, setMode] = useState<"text-to-3d" | "image-to-3d">("image-to-3d");
  const [textPrompt, setTextPrompt] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [currentJobId, setCurrentJobId] = useState<string>();
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string>();
  const [generatedModelInfo, setGeneratedModelInfo] = useState<{
    faces?: number;
    vertices?: number;
    topology?: string;
  }>();

  const generationParams: GenerationParams = {
    provider: "tripo",
    mode: mode === "text-to-3d" ? "text-to-3d" : "image-to-3d",
    modelType: "standard",
    smartLowPoly: false,
  };

  const requiredCredits = calculateCredits(generationParams);

  const canGenerate = () => {
    if (mode === "text-to-3d") {
      return textPrompt.trim().length > 0;
    }
    return uploadedFile !== null;
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 120;
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
          setGeneratedModelUrl(data.modelUrl);
          setGeneratedModelInfo(data.modelInfo);
          setGenerationStatus("completed");
          setIsGenerating(false);
          onModelGenerated?.(data.modelUrl, data.modelInfo);
          toast.success(t("generationSuccess") || "生成成功！");
        } else if (data.status === "FAILED") {
          setGenerationStatus("failed");
          setIsGenerating(false);
          toast.error(data.error || t("generationError"));
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            setGenerationStatus("failed");
            setIsGenerating(false);
            toast.error("生成超时，请重试");
          } else {
            setTimeout(poll, 5000);
          }
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          setGenerationStatus("failed");
          setIsGenerating(false);
          toast.error("检查生成状态失败");
        } else {
          setTimeout(poll, 5000);
        }
      }
    };

    poll();
  };

  const handleGenerate = async () => {
    if (!canGenerate()) {
      toast.error("请填写必要信息");
      return;
    }

    if (isLoadingBenefits) {
      toast.error("正在加载用户信息，请稍候...");
      return;
    }

    if (benefits) {
      const availableCredits = benefits.totalAvailableCredits ?? 0;
      if (availableCredits < requiredCredits) {
        toast.error(`积分不足。需要: ${requiredCredits}, 可用: ${availableCredits}`);
        return;
      }
    }

    setIsGenerating(true);
    setGenerationStatus("processing");

    try {
      const imageData = mode === "image-to-3d" && uploadedFile
        ? await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedFile);
        })
        : undefined;

      const response = await fetch("/api/ai-3d/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: mode === "text-to-3d" ? "text-to-3d" : "image-to-3d",
          provider: "tripo",
          modelType: "standard",
          smartLowPoly: false,
          publicVisibility: true,
          outputFormat: "GLB",
          textPrompt: mode === "text-to-3d" ? textPrompt : undefined,
          images: imageData ? [imageData] : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "生成失败");
      }

      const data = await response.json();

      if (data.jobId) {
        setCurrentJobId(data.jobId);
        setGenerationStatus("processing");
        toast.success("开始生成，请稍候...");
        pollJobStatus(data.jobId);
      } else if (data.modelUrl) {
        setGeneratedModelUrl(data.modelUrl);
        setGeneratedModelInfo(data.modelInfo);
        setGenerationStatus("completed");
        setIsGenerating(false);
        onModelGenerated?.(data.modelUrl, data.modelInfo);
        toast.success("生成成功！");
      } else {
        throw new Error("意外的响应格式");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "生成失败";
      toast.error(errorMessage);
      setGenerationStatus("failed");
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
  };

  const handleClearFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="w-full space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "text-to-3d" | "image-to-3d")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="image-to-3d">图片转 3D</TabsTrigger>
          <TabsTrigger value="text-to-3d">文字转 3D</TabsTrigger>
        </TabsList>

        <TabsContent value="image-to-3d" className="space-y-4">
          {uploadedFile ? (
            <div className="relative">
              <div className="border-2 border-dashed border-primary rounded-lg p-4 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{uploadedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleClearFile}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <UploadArea
              label="上传图片"
              onUpload={handleFileUpload}
              size="medium"
            />
          )}
        </TabsContent>

        <TabsContent value="text-to-3d" className="space-y-4">
          <Textarea
            placeholder="描述你想要生成的 3D 模型，例如：一个红色的机器人"
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            className="min-h-[120px]"
          />
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <span className="text-sm text-muted-foreground">所需积分</span>
        <span className="text-lg font-semibold">{requiredCredits}</span>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleGenerate}
        disabled={isGenerating || !canGenerate() || isLoadingBenefits}
      >
        {isGenerating ? (
          <>
            <Sparkles className="w-4 h-4 mr-2 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            立即生成
          </>
        )}
      </Button>

      {/* 生成状态提示 */}
      {generationStatus === "processing" && (
        <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">正在生成 3D 模型...</p>
              <p className="text-xs text-muted-foreground mt-1">这可能需要几分钟时间，生成的模型将显示在右侧预览区</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

