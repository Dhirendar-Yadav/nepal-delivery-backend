import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart] = useState(() => ({
    restaurant: null,
    items: [],
  }));

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
