import { catalog } from "@/data/catalog";
import type { Category, MenuItem } from "@/types/catalog";

interface SearchOptions {
  category?: Category | "all";
  maxResults?: number;
}

// Score a single menu item against an array of search terms.
// Higher score = better match. Name matches weighted highest.
function scoreItem(item: MenuItem, terms: string[]): number {
  let score = 0;

  const name = item.name.toLowerCase();
  const desc = item.description.toLowerCase();
  const allText = [
    name,
    desc,
    item.category,
    ...item.tags,
    ...(item.toppings ?? []),
    ...item.dietary,
  ]
    .join(" ")
    .toLowerCase();

  for (const term of terms) {
    if (!term) continue;
    if (name.includes(term)) score += 10;         // name match: highest weight
    if (item.tags.includes(term)) score += 5;     // exact tag match
    if (desc.includes(term)) score += 3;          // description match
    if (allText.includes(term)) score += 1;       // any field catch-all
  }

  if (item.isSpecial) score += 2; // small boost for specials

  return score;
}

// Main search function — used by the agent's search_catalog tool
export function searchCatalog(query: string, options: SearchOptions = {}): MenuItem[] {
  const { category = "all", maxResults = 3 } = options;

  // Split query into individual terms (lowercase)
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1); // skip single-char words

  const items = catalog.filter((item) => {
    if (!item.available) return false;
    if (category !== "all" && item.category !== category) return false;
    return true;
  });

  const scored = items
    .map((item) => ({ item, score: scoreItem(item, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ item }) => item);

  // If no matches found, return top items by isSpecial + category
  if (scored.length === 0) {
    return items
      .sort((a, b) => (b.isSpecial ? 1 : 0) - (a.isSpecial ? 1 : 0))
      .slice(0, maxResults);
  }

  return scored;
}

// Get a single item by ID — used by add_to_cart validation
export function getItemById(id: string): MenuItem | undefined {
  return catalog.find((item) => item.id === id);
}

// Get all specials
export function getSpecials(): MenuItem[] {
  return catalog.filter((item) => item.isSpecial && item.available);
}
