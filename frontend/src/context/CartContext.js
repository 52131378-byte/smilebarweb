import React, { createContext, useState } from "react";
import { toast } from "react-toastify";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const getProductId = (p) => p?.id ?? p?._id;
  const getQuantity = (p) => Number(p?.quantity || 0);
  const clampQty = (n) => {
    const v = Number(n);
    if (Number.isNaN(v) || !Number.isFinite(v)) return 1;
    return Math.max(1, Math.floor(v));
  };

  const addToCart = (product, qty = 1) => {
    const productName = product?.name ?? "Item";
    const productId = getProductId(product);
    const quantityToAdd = clampQty(qty);

    // If we can't identify the product reliably, fall back to allowing adds.
    if (productId == null) {
      setCartItems((prev) => [...prev, { ...product, quantity: quantityToAdd }]);
      toast.success(`${productName} added to cart`);
      return;
    }

    setCartItems((prev) => {
      const idx = prev.findIndex((item) => getProductId(item) === productId);
      if (idx >= 0) {
        const current = prev[idx];
        const nextQty = clampQty(getQuantity(current) + quantityToAdd);
        const next = [...prev];
        next[idx] = { ...current, quantity: nextQty };
        return next;
      }

      return [...prev, { ...product, quantity: quantityToAdd }];
    });

    toast.success(`${productName} added to cart`, {
      toastId: `cart-added-${productId}`,
    });
  };

  const incrementQuantity = (id) => {
    setCartItems((prev) =>
      prev.map((item) =>
        getProductId(item) === id
          ? { ...item, quantity: clampQty(getQuantity(item) + 1) }
          : item
      )
    );
  };

  const decrementQuantity = (id) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (getProductId(item) !== id) return item;
          const nextQty = getQuantity(item) - 1;
          if (nextQty <= 0) return null;
          return { ...item, quantity: clampQty(nextQty) };
        })
        .filter(Boolean)
    );
  };

  const setQuantity = (id, quantity) => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return removeFromCart(id);

    setCartItems((prev) =>
      prev.map((item) =>
        getProductId(item) === id ? { ...item, quantity: clampQty(qty) } : item
      )
    );
  };

  const removeFromCart = (id) => {
    setCartItems((prev) => prev.filter((item) => getProductId(item) !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        incrementQuantity,
        decrementQuantity,
        setQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
