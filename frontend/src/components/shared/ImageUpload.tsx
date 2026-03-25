"use client";
// src/components/shared/ImageUpload.tsx
// Security: validates MIME type and 5 MB limit before upload

import { useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateImage } from "@/types";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export function ImageUpload({ value, onChange, disabled, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File | null) {
    setError(null);
    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }

    // Security: validate MIME type and file size
    const result = validateImage(file);
    if (!result.valid) {
      setError(result.error ?? "Invalid file.");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed cursor-pointer transition-colors",
          "min-h-[140px] bg-muted/40 hover:bg-muted/60",
          dragging && "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
          !dragging && "border-muted-foreground/30",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="max-h-[130px] max-w-full rounded object-contain p-1"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <div className="rounded-full bg-muted p-3">
              {dragging ? (
                <Upload className="h-5 w-5 text-orange-500" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {dragging ? "Drop it here" : "Click or drag image here"}
            </p>
            <p className="text-xs text-muted-foreground/70">
              JPG, PNG, WebP · Max 5 MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
          <X className="h-3 w-3" />
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />
    </div>
  );
}
