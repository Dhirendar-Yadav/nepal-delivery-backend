import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CART_STORAGE_KEY = "foodsamundar:cart:v1";

const createEmptyCheckoutAttempt = () => ({
  attemptId: null,
  createdAt: null,
  status: null,
});

const createEmptyCart = () => ({
  restaurant: null,
  items: [],
  pendingCheckout: createEmptyCheckoutAttempt(),
});

const isValidCheckoutAttempt = (pendingCheckout) => (
  pendingCheckout &&
  typeof pendingCheckout === 'object' &&
  !Array.isArray(pendingCheckout) &&
  (pendingCheckout.attemptId === null || typeof pendingCheckout.attemptId === 'string') &&
  (pendingCheckout.createdAt === null || Number.isFinite(pendingCheckout.createdAt)) &&
  (pendingCheckout.status === null || typeof pendingCheckout.status === 'string')
);

const isValidRestaurant = (restaurant) => (
  restaurant === null || (
    restaurant &&
    typeof restaurant === 'object' &&
    !Array.isArray(restaurant) &&
    Boolean(restaurant._id || restaurant.id)
  )
);

const isValidCartItem = (item) => (
  item &&
  typeof item === 'object' &&
  !Array.isArray(item) &&
  Boolean(item._id || item.id) &&
  typeof item.name === 'string' &&
  item.name.trim().length > 0 &&
  typeof item.price === 'number' &&
  Number.isFinite(item.price) &&
  typeof item.quantity === 'number' &&
  Number.isFinite(item.quantity) &&
  item.quantity > 0
);

const isValidCart = (cart) => (
  cart &&
  typeof cart === 'object' &&
  !Array.isArray(cart) &&
  isValidRestaurant(cart.restaurant) &&
  Array.isArray(cart.items)
);

const persistCart = (cart) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Keep the in-memory cart available when storage is unavailable.
  }
};

const readStoredCart = () => {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCart) return createEmptyCart();

    const parsedCart = JSON.parse(storedCart);
    if (!isValidCart(parsedCart)) return createEmptyCart();

    const validItems = parsedCart.items.filter(isValidCartItem);
    const items = parsedCart.restaurant ? validItems : [];

    return {
      ...parsedCart,
      restaurant: items.length > 0 ? parsedCart.restaurant : null,
      items,
      pendingCheckout: isValidCheckoutAttempt(parsedCart.pendingCheckout)
        ? parsedCart.pendingCheckout
        : createEmptyCheckoutAttempt(),
    };
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
    persistCart(cart);
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
        ...currentCart,
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
        ...currentCart,
        restaurant: items.length > 0 ? currentCart.restaurant : null,
        items,
      };
    });
  };

  const removeItem = (itemId) => {
    setCart((currentCart) => {
      const items = currentCart.items.filter((item) => getItemId(item) !== itemId);

      return {
        ...currentCart,
        restaurant: items.length > 0 ? currentCart.restaurant : null,
        items,
      };
    });
  };

  const clearCart = () => {
    setCart(createEmptyCart());
  };

  const beginCheckoutAttempt = useCallback(() => {
    if (cart.pendingCheckout.attemptId) return cart.pendingCheckout;

    const attempt = {
      attemptId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      status: 'pending',
    };
    const nextCart = { ...cart, pendingCheckout: attempt };

    setCart(nextCart);
    return attempt;
  }, [cart]);

  const clearCheckoutAttempt = useCallback(() => {
    const nextCart = { ...cart, pendingCheckout: createEmptyCheckoutAttempt() };

    setCart(nextCart);
  }, [cart]);

  const reconcileCart = useCallback((menuItems) => {
    if (!Array.isArray(menuItems)) return;

    const latestMenuItems = new Map(
      menuItems
        .map((menuItem) => [getItemId(menuItem), menuItem])
        .filter(([menuItemId]) => menuItemId)
    );

    setCart((currentCart) => {
      const items = currentCart.items.reduce((updatedItems, cartItem) => {
        const menuItem = latestMenuItems.get(getItemId(cartItem));
        return menuItem
          ? [...updatedItems, { ...cartItem, price: menuItem.price }]
          : updatedItems;
      }, []);

      return {
        ...currentCart,
        restaurant: items.length > 0 ? currentCart.restaurant : null,
        items,
      };
    });
  }, []);

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
    beginCheckoutAttempt,
    clearCheckoutAttempt,
    reconcileCart,
    pendingCheckout: cart.pendingCheckout,
    totalQuantity,
    totalAmount,
  }), [cart, beginCheckoutAttempt, clearCheckoutAttempt, reconcileCart, totalAmount, totalQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);

  if (!cart) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return cart;
}
