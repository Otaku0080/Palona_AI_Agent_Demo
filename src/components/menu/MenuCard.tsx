"use client";

import Image from "next/image";
import { Plus, MessageCircle } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { getBasePrice, hasSizes, type MenuItem } from "@/types/catalog";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

interface MenuCardProps {
  item: MenuItem;
  onAskSal?: (query: string) => void;
}

export default function MenuCard({ item, onAskSal }: MenuCardProps) {
  const addItem = useCartStore((state) => state.addItem);

  function handleAddToCart() {
    const price = hasSizes(item.price) ? item.price.medium : item.price;
    const effectivePrice = item.isSpecial && item.specialPrice ? item.specialPrice : price;

    addItem({
      itemId: item.id,
      name: item.name,
      price: effectivePrice,
      quantity: 1,
      size: hasSizes(item.price) ? "medium" : undefined,
      imageUrl: item.imageUrl,
    });
    toast.success(`Added ${item.name} to cart!`);
  }

  const displayPrice = item.isSpecial && item.specialPrice
    ? item.specialPrice
    : getBasePrice(item.price);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative h-44 bg-gray-100 overflow-hidden">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            // Fallback to a colored placeholder if image fails to load
            (e.target as HTMLImageElement).src = `https://placehold.co/400x300/e8400c/ffffff?text=${encodeURIComponent(item.name)}`;
          }}
        />
        {item.isSpecial && (
          <span className="absolute top-2 left-2 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full">
            SPECIAL
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
          <div className="text-right shrink-0">
            {item.isSpecial && item.specialPrice ? (
              <div>
                <span className="text-brand font-bold text-sm">
                  {formatPrice(item.specialPrice)}
                </span>
                <span className="text-gray-400 text-xs line-through ml-1">
                  {formatPrice(getBasePrice(item.price))}
                </span>
              </div>
            ) : (
              <span className="text-brand font-bold text-sm">
                {hasSizes(item.price)
                  ? `from ${formatPrice(displayPrice)}`
                  : formatPrice(displayPrice)}
              </span>
            )}
          </div>
        </div>

        {/* Dietary tags */}
        {item.dietary.length > 0 && (
          <div className="flex gap-1 mb-2">
            {item.dietary.map((d) => (
              <span
                key={d}
                className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        <p className="text-gray-500 text-xs line-clamp-2 mb-3">{item.description}</p>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-1 bg-brand text-white text-xs font-medium py-2 rounded-lg hover:bg-brand-dark transition-colors"
          >
            <Plus size={14} />
            Add to Cart
          </button>
          {onAskSal && (
            <button
              onClick={() => onAskSal(`Tell me more about the ${item.name}`)}
              className="flex items-center justify-center p-2 border border-gray-200 rounded-lg hover:border-brand hover:text-brand transition-colors"
              aria-label={`Ask Sal about ${item.name}`}
            >
              <MessageCircle size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
