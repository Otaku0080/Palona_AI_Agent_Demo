"use client";

import ReactMarkdown from "react-markdown";
import Image from "next/image";
import { Plus } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { catalog } from "@/data/catalog";
import { getBasePrice, hasSizes } from "@/types/catalog";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

// Parses [PRODUCT:item-id] markers that Sal embeds in responses
// and replaces them with inline product cards.
function parseMessageContent(content: string) {
  const parts = content.split(/(\[PRODUCT:[^\]]+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/\[PRODUCT:([^\]]+)\]/);
    if (match) {
      return <InlineProductCard key={i} itemId={match[1]} />;
    }
    return (
      <ReactMarkdown key={i} className="prose prose-sm max-w-none">
        {part}
      </ReactMarkdown>
    );
  });
}

function InlineProductCard({ itemId }: { itemId: string }) {
  const item = catalog.find((i) => i.id === itemId);
  const addItem = useCartStore((state) => state.addItem);

  if (!item) return null;

  const price = hasSizes(item.price) ? item.price.medium : item.price;
  const effectivePrice = item.isSpecial && item.specialPrice ? item.specialPrice : price;

  function handleAdd() {
    addItem({
      itemId: item!.id,
      name: item!.name,
      price: effectivePrice,
      quantity: 1,
      size: hasSizes(item!.price) ? "medium" : undefined,
      imageUrl: item!.imageUrl,
    });
    toast.success(`Added ${item!.name} to cart!`);
  }

  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3 my-2">
      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-200">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          className="object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/48x48/e8400c/ffffff?text=🍕`;
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
        <p className="text-brand font-bold text-sm">
          {item.isSpecial && item.specialPrice
            ? formatPrice(item.specialPrice)
            : hasSizes(item.price)
            ? `from ${formatPrice(getBasePrice(item.price))}`
            : formatPrice(item.price as number)}
        </p>
      </div>
      <button
        onClick={handleAdd}
        className="shrink-0 flex items-center gap-1 bg-brand text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-brand-dark transition-colors"
      >
        <Plus size={12} />
        Add
      </button>
    </div>
  );
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs shrink-0 mr-2 mt-1">
          🍕
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-brand text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="space-y-1">{parseMessageContent(content)}</div>
        )}
      </div>
    </div>
  );
}
