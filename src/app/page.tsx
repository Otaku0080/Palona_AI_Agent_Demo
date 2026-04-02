"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import MenuGrid from "@/components/menu/MenuGrid";
import CartDrawer from "@/components/cart/CartDrawer";
import ChatWidget from "@/components/agent/ChatWidget";
import { catalog } from "@/data/catalog";

export default function Home() {
  const [cartOpen, setCartOpen] = useState(false);
  // When a user clicks "Ask Sal" on a menu card, we pre-fill the chat
  const [askSalMessage, setAskSalMessage] = useState<string | undefined>();

  function handleAskSal(query: string) {
    setAskSalMessage(query);
  }

  return (
    <div className="min-h-screen">
      <Header onCartClick={() => setCartOpen(true)} />

      {/* Hero section */}
      <div className="bg-gradient-to-br from-brand to-brand-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Pizza Made Fresh,{" "}
            <span className="text-yellow-300">Ordered Smart</span>
          </h1>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
            Not sure what to order? Ask Sal — our AI assistant — for personalized
            recommendations, voice ordering, or snap a photo of a pizza you love.
          </p>
          <button
            onClick={() => setAskSalMessage("What do you recommend for a first-time visitor?")}
            className="bg-white text-brand font-semibold px-8 py-3 rounded-full hover:bg-yellow-50 transition-colors shadow-lg"
          >
            🍕 Ask Sal for a Recommendation
          </button>
        </div>
      </div>

      {/* Menu */}
      <MenuGrid items={catalog} onAskSal={handleAskSal} />

      {/* Cart drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* AI chat widget — floats bottom-right */}
      <ChatWidget
        initialMessage={askSalMessage}
        onClearInitialMessage={() => setAskSalMessage(undefined)}
      />
    </div>
  );
}
