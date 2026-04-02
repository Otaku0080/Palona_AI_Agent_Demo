import { NextResponse } from "next/server";
import { catalog, CATEGORIES } from "@/data/catalog";

export async function GET() {
  const specials = catalog.filter((item) => item.isSpecial && item.available);
  return NextResponse.json({ items: catalog, categories: CATEGORIES, specials });
}
