import { create } from "zustand";
import type { CartItem, CartState } from "@/types/cart";

// Zustand store — think of it as a global useState that any component can read/write.
// No Context provider needed; just import useCartStore anywhere.
export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (newItem: CartItem) => {
    set((state) => {
      // Check if the same item+size already exists in the cart
      const existing = state.items.find(
        (i) => i.itemId === newItem.itemId && i.size === newItem.size
      );
      if (existing) {
        // Increment quantity instead of duplicating
        return {
          items: state.items.map((i) =>
            i.itemId === newItem.itemId && i.size === newItem.size
              ? { ...i, quantity: i.quantity + newItem.quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (itemId: string, size?: string) => {
    set((state) => ({
      items: state.items.filter((i) => !(i.itemId === itemId && i.size === size)),
    }));
  },

  updateQuantity: (itemId: string, quantity: number, size?: string) => {
    if (quantity <= 0) {
      get().removeItem(itemId, size);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.itemId === itemId && i.size === size ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
