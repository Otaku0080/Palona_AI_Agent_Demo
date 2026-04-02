import { useState } from "react";
import MenuCard from "./MenuCard";
import type { MenuItem, Category } from "../../types/catalog";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Items",
  pizza: "🍕 Pizzas",
  sides: "🍟 Sides",
  drinks: "🥤 Drinks",
  desserts: "🍰 Desserts",
};

interface MenuGridProps {
  items: MenuItem[];
  onAskSal?: (query: string) => void;
}

export default function MenuGrid({ items, onAskSal }: MenuGridProps) {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");

  const filtered =
    activeCategory === "all"
      ? items
      : items.filter((item) => item.category === activeCategory);

  const categories = ["all", "pizza", "sides", "drinks", "desserts"] as const;

  return (
    <section id="menu" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Menu</h2>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-brand text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <MenuCard key={item.id} item={item} onAskSal={onAskSal} />
        ))}
      </div>
    </section>
  );
}
