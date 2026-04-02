// Format a number as a USD price string, e.g. 14.99 → "$14.99"
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

// Conditionally join class names (simple replacement for clsx/cn)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
