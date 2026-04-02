"use client";

import { useState, useCallback } from "react";

export interface ImageAttachment {
  preview: string;    // data URL for thumbnail display
  base64: string;     // raw base64 (without data: prefix) to send to the API
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

// Resizes an image to max 800px on its longest side, then converts to base64.
// This keeps API payloads small (~100-200KB) so the demo feels fast.
function resizeImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX = 800;
      let { width, height } = img;

      // Scale down if either dimension exceeds MAX
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to blob, then to base64
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to compress image"));
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Split "data:image/jpeg;base64,XXXX" → we need just "XXXX"
            const base64 = dataUrl.split(",")[1];
            resolve({ preview: dataUrl, base64, mediaType: "image/jpeg" });
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.85 // 85% quality — good balance of size vs clarity
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = objectUrl;
  });
}

export function useImageUpload() {
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await resizeImage(file);
      setAttachment(result);
    } catch {
      setError("Failed to process image. Please try another file.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachment(null);
    setError(null);
  }, []);

  return { attachment, isProcessing, error, processFile, clearAttachment };
}
