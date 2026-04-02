"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import Image from "next/image";
import type { ImageAttachment } from "@/hooks/useImageUpload";

interface ImageUploadProps {
  attachment: ImageAttachment | null;
  isProcessing: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}

export default function ImageUpload({
  attachment,
  isProcessing,
  onFile,
  onClear,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  }

  return (
    <div className="relative shrink-0">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {attachment ? (
        // Show thumbnail with a remove button
        <div className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-brand">
          <Image
            src={attachment.preview}
            alt="Attached image"
            fill
            className="object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm"
            aria-label="Remove image"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        // Camera button
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="p-2 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-100 transition-colors disabled:opacity-50"
          aria-label="Attach a food photo"
          title="Upload a food photo to find similar items"
        >
          <Camera size={18} />
        </button>
      )}
    </div>
  );
}
