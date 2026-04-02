"use client";

import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCartStore();

  function handleCheckout() {
    toast.success("Order placed! 🍕 Your pizza is on its way.");
    clearCart();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer panel — slides in from the right */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={20} className="text-brand" />
            Your Order
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🛒</p>
              <p className="font-medium">Your cart is empty</p>
              <p className="text-sm mt-1">Add some delicious items to get started!</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.itemId}-${item.size}`}
                className="flex gap-3 bg-gray-50 rounded-xl p-3"
              >
                {/* Item image */}
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://placehold.co/56x56/e8400c/ffffff?text=🍕`;
                    }}
                  />
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                  {item.size && (
                    <p className="text-xs text-gray-400 capitalize">{item.size}</p>
                  )}
                  <p className="text-brand font-semibold text-sm">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.itemId, item.quantity - 1, item.size)}
                    className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.itemId, item.quantity + 1, item.size)}
                    className="w-6 h-6 rounded-full bg-brand text-white hover:bg-brand-dark flex items-center justify-center transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with total + checkout */}
        {items.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">{formatPrice(totalPrice())}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>Delivery fee</span>
              <span>{totalPrice() >= 30 ? "FREE" : "$3.99"}</span>
            </div>
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total</span>
              <span className="text-brand">
                {formatPrice(totalPrice() + (totalPrice() >= 30 ? 0 : 3.99))}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-brand text-white py-3 rounded-xl font-semibold hover:bg-brand-dark transition-colors"
            >
              Place Order 🍕
            </button>
          </div>
        )}
      </div>
    </>
  );
}
