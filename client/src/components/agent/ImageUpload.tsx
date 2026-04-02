import { useRef } from "react";
import { Camera, X } from "lucide-react";
import type { ImageAttachment } from "../../hooks/useImageUpload";

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
    <div className="relative shrink-0 group">
      {/* Hidden file input — restricted to formats that work reliably with canvas resize */}
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
          <img
            src={attachment.preview}
            alt="Attached image"
            className="w-full h-full object-cover"
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
        // Camera button + format tooltip on hover
        <div className="relative">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            className="p-2 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Attach a food photo"
          >
            <Camera size={18} />
          </button>
          {/* Format hint — appears above the button on hover */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
            <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
              JPG · PNG · WebP · GIF · BMP · AVIF · Max 10MB
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
