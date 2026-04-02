import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// cn() merges Tailwind classes safely — prevents conflicting classes
// Example: cn("px-2 py-1", isActive && "bg-red-500") → "px-2 py-1 bg-red-500"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
