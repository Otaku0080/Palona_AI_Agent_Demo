export type Category = "pizza" | "sides" | "drinks" | "desserts";

export interface PriceBySize {
  small: number;
  medium: number;
  large: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number | PriceBySize;
  imageUrl: string;
  tags: string[];
  dietary: string[];
  allergens: string[];
  calories: number;
  isSpecial: boolean;
  specialPrice?: number;
  available: boolean;
  toppings?: string[];
}

// Helper to check if price is tiered by size
export function hasSizes(price: number | PriceBySize): price is PriceBySize {
  return typeof price === "object";
}

// Helper to get the base display price
export function getBasePrice(price: number | PriceBySize): number {
  if (hasSizes(price)) return price.medium;
  return price;
}
