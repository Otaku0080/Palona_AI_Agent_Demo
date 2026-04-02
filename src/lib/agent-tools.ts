import { tool } from "ai";
import { z } from "zod";
import { searchCatalog, getItemById, getSpecials } from "@/lib/catalog-search";
import { catalog } from "@/data/catalog";
import { getBasePrice, hasSizes } from "@/types/catalog";

// ─── System Prompt ────────────────────────────────────────────────────────────
// This is Sal's personality and operating rules. Claude will follow these
// instructions on every request.
export const SYSTEM_PROMPT = `You are "Sal", the friendly AI ordering assistant for PalonaSlice Pizza 🍕

Your job is to help customers discover menu items, get personalized recommendations,
and place orders. You are warm, enthusiastic about food, and concise.

RULES:
- Always call search_catalog or identify_food_from_image BEFORE recommending any food item.
  Never invent or mention items not returned by those tools.
- When you recommend items, include [PRODUCT:item-id] in your response so the UI
  can display a product card. Example: "I'd recommend our Meat Lovers [PRODUCT:meat-lovers]!"
- For add_to_cart, only call it when the customer explicitly confirms they want to order.
- Keep responses short — 2-4 sentences max. Use bullet points for lists.
- Be honest if something is out of stock or not on the menu.

Today's specials: ${getSpecials()
  .map((s) => `${s.name} ($${s.specialPrice ?? getBasePrice(s.price)})`)
  .join(", ")}
`;

// ─── Tool Definitions ─────────────────────────────────────────────────────────
// Each tool is a function Claude can call. The `execute` function runs on the
// server and returns a result that Claude uses to write its response.

export const agentTools = {
  // Tool 1: Text-based catalog search
  // Claude calls this for any food recommendation or search query.
  search_catalog: tool({
    description:
      "Search the PalonaSlice menu catalog. Use this for ANY food-related query: " +
      "recommendations, finding specific items, filtering by category, dietary restrictions, " +
      "price range, group size, or cuisine style.",
    parameters: z.object({
      query: z.string().describe("Natural language search query, e.g. 'spicy chicken pizza'"),
      category: z
        .enum(["pizza", "sides", "drinks", "desserts", "all"])
        .optional()
        .default("all")
        .describe("Optional category filter"),
      maxResults: z.number().optional().default(3).describe("Max items to return (default 3)"),
    }),
    execute: async ({ query, category, maxResults }) => {
      const results = searchCatalog(query, { category, maxResults });
      if (results.length === 0) {
        return { found: false, items: [], message: "No matching items found on the menu." };
      }
      return {
        found: true,
        items: results.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description,
          price: hasSizes(item.price)
            ? `Small $${item.price.small} / Medium $${item.price.medium} / Large $${item.price.large}`
            : `$${item.price}`,
          tags: item.tags,
          dietary: item.dietary,
          isSpecial: item.isSpecial,
          specialPrice: item.specialPrice,
        })),
      };
    },
  }),

  // Tool 2: Image-based food identification
  // Claude has already seen the image (it's in the message content).
  // This tool asks Claude to describe what it sees, then searches the catalog.
  identify_food_from_image: tool({
    description:
      "Called when the user uploads a food photo. Describe what you see in the image " +
      "(toppings, style, ingredients), then search the catalog for similar items. " +
      "Use this tool whenever there is an image in the conversation.",
    parameters: z.object({
      imageDescription: z
        .string()
        .describe("Your detailed description of the food in the image"),
      searchTerms: z
        .array(z.string())
        .describe("Key food terms from the image to search the catalog with"),
    }),
    execute: async ({ imageDescription, searchTerms }) => {
      const query = searchTerms.join(" ");
      const results = searchCatalog(query, { maxResults: 3 });
      return {
        imageDescription,
        found: results.length > 0,
        items: results.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: hasSizes(item.price)
            ? `Small $${item.price.small} / Medium $${item.price.medium} / Large $${item.price.large}`
            : `$${item.price}`,
          tags: item.tags,
          isSpecial: item.isSpecial,
        })),
      };
    },
  }),

  // Tool 3: Add item to cart
  // Claude calls this when the customer confirms they want to order.
  // The result includes a cart_update annotation that the client reads.
  add_to_cart: tool({
    description:
      "Add a menu item to the customer's cart. ONLY call this after the customer " +
      "has explicitly said they want to order the item (e.g. 'yes add it', 'I'll take that').",
    parameters: z.object({
      itemId: z.string().describe("The item ID from the catalog, e.g. 'meat-lovers'"),
      quantity: z.number().min(1).default(1).describe("Number of items to add"),
      size: z
        .enum(["small", "medium", "large"])
        .optional()
        .describe("Size for pizzas — medium if not specified"),
    }),
    execute: async ({ itemId, quantity, size }) => {
      const item = getItemById(itemId);
      if (!item) {
        return { success: false, message: `Item "${itemId}" not found on the menu.` };
      }

      // Calculate the price for the chosen size
      let price: number;
      if (hasSizes(item.price)) {
        const chosenSize = size ?? "medium";
        price = item.isSpecial && item.specialPrice
          ? item.specialPrice
          : item.price[chosenSize];
      } else {
        price = item.isSpecial && item.specialPrice ? item.specialPrice : item.price;
      }

      return {
        success: true,
        // This cart_update object is read by the client's onFinish callback
        // to update the Zustand store without a separate API call.
        cart_update: {
          type: "cart_update",
          action: "add",
          itemId: item.id,
          name: item.name,
          price,
          quantity,
          size: hasSizes(item.price) ? (size ?? "medium") : undefined,
          imageUrl: item.imageUrl,
        },
        message: `Added ${quantity}x ${item.name}${size ? ` (${size})` : ""} — $${price.toFixed(2)} each.`,
      };
    },
  }),

  // Tool 4: Restaurant info
  // Returns hardcoded facts so Claude never guesses about hours, location, etc.
  get_restaurant_info: tool({
    description:
      "Get factual information about PalonaSlice restaurant: hours, location, delivery, " +
      "allergens, promotions, or loyalty program. Use this instead of guessing.",
    parameters: z.object({
      topic: z
        .enum(["hours", "location", "delivery", "allergens", "promotions", "loyalty", "general"])
        .describe("What information the customer needs"),
    }),
    execute: async ({ topic }) => {
      const info: Record<string, string> = {
        hours:
          "We're open Mon–Thu 11am–10pm, Fri–Sat 11am–11pm, Sun 12pm–9pm.",
        location:
          "123 Slice Street, San Francisco, CA 94102. Free parking behind the building on weekends.",
        delivery:
          "We deliver within 5 miles. Free delivery on orders over $30. Usually 30–45 minutes.",
        allergens:
          "Common allergens in our kitchen: gluten, dairy, eggs. We can accommodate gluten-free crust on request (+$2). " +
          "Please inform staff of severe allergies as we cannot guarantee a fully allergen-free environment.",
        promotions:
          "Current deals: Truffle Mushroom pizza at $17.99 (reg $19.99), Loaded Fries at $7.99 (reg $9.99), " +
          "Chocolate Lava Cake at $4.99 (reg $5.99), Craft Lemonade at $3.49 (reg $4.99).",
        loyalty:
          "Join Slice Rewards — earn 1 point per dollar. 100 points = $5 off. Sign up at the register or on our app.",
        general:
          "PalonaSlice is a family-friendly pizza restaurant serving handmade pies and fresh sides. " +
          "Founded in 2015, we use locally sourced ingredients and bake everything fresh to order.",
      };
      return { topic, info: info[topic] ?? info.general };
    },
  }),
};
