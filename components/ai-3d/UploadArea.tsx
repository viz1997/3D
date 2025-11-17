"use client";

import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface UploadAreaProps {
  label: string;
  required?: boolean;
  onUpload?: (file: File) => void;
  size?: "small" | "medium";
  className?: string;
  previewUrl?: string | null;
}

export function UploadArea({
  label,
  required = false,
  onUpload,
  size = "medium",
  className,
  previewUrl,
}: UploadAreaProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  const heightClass = size === "small" ? "h-32" : "h-48";
  const iconSize = size === "small" ? "w-5 h-5" : "w-6 h-6";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        className={cn(
          "relative w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center group",
          heightClass,
          "border-[#2d3548] bg-[#1a1f2e] hover:bg-[#1f2937] dark:border-[#2d3548] dark:bg-[#1a1f2e] dark:hover:bg-[#1f2937]",
          className
        )}
      >
        <input
          type="file"
          className="sr-only"
          accept="image/*"
          onChange={handleFileChange}
        />
        {previewUrl ? (
          <>
            <img src={previewUrl} alt={`${label} preview`} className="absolute inset-0 h-full w-full object-cover rounded-lg" />
            <div className="absolute inset-0 rounded-lg bg-black/40 flex flex-col items-center justify-center text-center px-3">
              <span className="text-white text-xs font-medium">{label}</span>
              <span className="text-[11px] text-gray-200 mt-1">{required ? "已上传（可点击更换）" : "点击更换图片"}</span>
            </div>
          </>
        ) : (
          <>
            <Upload
              className={cn(
                iconSize,
                "text-gray-500 group-hover:text-gray-400 mb-1.5"
              )}
            />
            <span className="text-gray-400 text-xs">{label}</span>
            {required && <span className="text-red-500 text-xs ml-1">*</span>}
          </>
        )}
      </label>
    </div>
  );
}

