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

const getRestaurantId = (restaurant) => restaurant?._id || restaurant?.id || restaurant;

const getItemId = (item) => item?._id || item?.id;

const getItemRestaurant = (item) => {
  if (item?.restaurant) return item.restaurant;
  if (item?.restaurantId) return { _id: item.restaurantId };
  return null;
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

  const addItem = (item) => {
    const itemId = getItemId(item);
    const itemRestaurant = getItemRestaurant(item);
    const itemRestaurantId = getRestaurantId(itemRestaurant);

    if (!itemId || !itemRestaurantId) return;

    setCart((currentCart) => {
      const currentRestaurantId = getRestaurantId(currentCart.restaurant);
      if (currentRestaurantId && currentRestaurantId !== itemRestaurantId) return currentCart;

      const existingItem = currentCart.items.find((cartItem) => getItemId(cartItem) === itemId);
      const items = existingItem
        ? currentCart.items.map((cartItem) => (
          getItemId(cartItem) === itemId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ))
        : [...currentCart.items, { ...item, quantity: 1 }];

      return {
        restaurant: currentCart.restaurant || itemRestaurant,
        items,
      };
    });
  };

  const increaseQuantity = (itemId) => {
    setCart((currentCart) => ({
      ...currentCart,
      items: currentCart.items.map((item) => (
        getItemId(item) === itemId ? { ...item, quantity: item.quantity + 1 } : item
      )),
    }));
  };

  const decreaseQuantity = (itemId) => {
    setCart((currentCart) => {
      const items = currentCart.items.reduce((updatedItems, item) => {
        if (getItemId(item) !== itemId) return [...updatedItems, item];

        const quantity = item.quantity - 1;
        return quantity > 0 ? [...updatedItems, { ...item, quantity }] : updatedItems;
      }, []);

      return {
        restaurant: items.length > 0 ? currentCart.restaurant : null,
        items,
      };
    });
  };

  const removeItem = (itemId) => {
    setCart((currentCart) => {
      const items = currentCart.items.filter((item) => getItemId(item) !== itemId);

      return {
        restaurant: items.length > 0 ? currentCart.restaurant : null,
        items,
      };
    });
  };

  const clearCart = () => {
    setCart(createEmptyCart());
  };

  const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.items.reduce((sum, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    return sum + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);

  const value = useMemo(() => ({
    cart,
    addItem,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
    totalQuantity,
    totalAmount,
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
