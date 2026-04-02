import { useState, useCallback } from "react";

export interface ImageAttachment {
  preview: string;
  base64: string;
  mediaType: string;
  file: File;
}

// Attempt to resize via canvas. Returns null if the browser can't decode the format.
function tryResizeImage(file: File): Promise<ImageAttachment | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX = 800;
      let { width, height } = img;

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
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(null); return; }
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            const resizedFile = new File([blob], file.name, { type: "image/jpeg" });
            resolve({ preview: dataUrl, base64, mediaType: "image/jpeg", file: resizedFile });
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.85
      );
    };

    // Canvas can't decode this format — signal fallback needed
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
    img.src = objectUrl;
  });
}

// Fallback: read the raw file as-is without any canvas processing.
// Works for any format the server can handle (AVIF, BMP, TIFF, etc.)
function readRawFile(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      const mimeType = file.type || "image/jpeg";
      resolve({ preview: dataUrl, base64, mediaType: mimeType, file });
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function useImageUpload() {
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (file.type === "image/heic" || file.type === "image/heif" ||
        file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
      setError("iPhone HEIC photos aren't supported. Share the photo as JPEG from your Photos app.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image exceeds the 10MB limit. Please use a smaller file.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Try canvas resize first (produces a smaller, normalized JPEG)
      const resized = await tryResizeImage(file);
      if (resized) {
        setAttachment(resized);
      } else {
        // Canvas couldn't decode the format — send the raw file instead
        const raw = await readRawFile(file);
        setAttachment(raw);
      }
    } catch {
      setError("Could not read this file. Try a JPG, PNG, or WebP photo.");
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
