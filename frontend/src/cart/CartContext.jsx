import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CART_STORAGE_KEY = "foodsamundar:cart:v1";

const createEmptyCart = () => ({
  restaurant: null,
  items: [],
});

const isValidCart = (cart) => (
  cart &&
  typeof cart === 'object' &&
  !Array.isArray(cart) &&
  (cart.restaurant === null || (typeof cart.restaurant === 'object' && !Array.isArray(cart.restaurant))) &&
  Array.isArray(cart.items)
);

const readStoredCart = () => {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCart) return createEmptyCart();

    const parsedCart = JSON.parse(storedCart);
    return isValidCart(parsedCart) ? parsedCart : createEmptyCart();
  } catch {
    return createEmptyCart();
  }
};

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readStoredCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Keep the in-memory cart available when storage is unavailable.
    }
  }, [cart]);

  const value = useMemo(() => ({
    cart,
    addItem: () => {},
    increaseQuantity: () => {},
    decreaseQuantity: () => {},
    removeItem: () => {},
    clearCart: () => {},
    totalQuantity: 0,
    totalAmount: 0,
  }), [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);

  if (!cart) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return cart;
}
