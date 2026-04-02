export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  imageUrl: string;
}

export interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string, size?: string) => void;
  updateQuantity: (itemId: string, quantity: number, size?: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}
