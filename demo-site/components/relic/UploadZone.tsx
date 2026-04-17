"use client";

import { useCallback, useState, type DragEvent, type HTMLAttributes } from "react";
import { Upload, X, FileUp } from "lucide-react";

import Surface from "@/components/site/Surface";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/I18nProvider";

export interface UploadZoneProps extends HTMLAttributes<HTMLDivElement> {
  readonly maxFileSizeMB?: number;
  readonly onFilesSelected?: (files: FileList) => void;
}

export default function UploadZone({
  maxFileSizeMB = 10,
  onFilesSelected,
  className,
  ...props
}: UploadZoneProps) {
  const { dict } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
    setError(null);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const oversized = Array.from(files).find(
          (file) => file.size > maxFileSizeMB * 1024 * 1024,
        );
        if (oversized) {
          setError(dict.upload.fileTooLarge(oversized.name, maxFileSizeMB));
          return;
        }
        onFilesSelected?.(files);
      }
    },
    [maxFileSizeMB, onFilesSelected, dict],
  );

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,audio/*,video/*,.pdf,.doc,.docx,.txt";
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        onFilesSelected?.(files);
      }
    };
    input.click();
  }, [onFilesSelected]);

  return (
    <Surface
      tone="default"
      padding="md"
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        isDragOver && "border-brand/50 bg-brand/5 ring-2 ring-brand/20",
        error && "border-red-300 bg-red-50/50",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      {...props}
    >
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        {error ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500">
              <X className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-red-600">{dict.upload.fileTooLargeTitle}</p>
            <p className="text-xs text-red-500">{error}</p>
          </>
        ) : isDragOver ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-brand">{dict.upload.dropToUpload}</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">{dict.upload.dragOrClick}</p>
            <p className="text-xs text-foreground-muted">
              {dict.upload.supportedFormats(maxFileSizeMB)}
            </p>
          </>
        )}
      </div>
    </Surface>
  );
}
