"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";

interface HeaderProps {
  onCartClick: () => void;
}

export default function Header({ onCartClick }: HeaderProps) {
  const totalItems = useCartStore((state) => state.totalItems());

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍕</span>
            <span className="text-xl font-bold text-gray-900">
              Palona<span className="text-brand">Slice</span>
            </span>
          </div>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#menu" className="hover:text-brand transition-colors">
              Menu
            </a>
            <a href="#" className="hover:text-brand transition-colors">
              About
            </a>
            <a href="#" className="hover:text-brand transition-colors">
              Locations
            </a>
          </nav>

          {/* Cart button */}
          <button
            onClick={onCartClick}
            className="relative flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-brand-dark transition-colors"
            aria-label={`Open cart, ${totalItems} items`}
          >
            <ShoppingCart size={16} />
            <span className="hidden sm:inline">Cart</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
