import { useCallback, useState } from 'react';

export default function useSellerStore({ API_BASE, fetchOrders }) {
  const [restaurant, setRestaurant] = useState(null);
  const [updatingStoreStatus, setUpdatingStoreStatus] = useState(false);

  const fetchRestaurant = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/seller/store`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setRestaurant(data.restaurant);
      } else {
        console.error(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [API_BASE]);

  const toggleStoreStatus = useCallback(async () => {
    if (!restaurant) return;

    setUpdatingStoreStatus(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/seller/store/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            isOpen: !restaurant.isOpen
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setRestaurant(data.restaurant);
        fetchOrders();
      } else {
        alert(data.error || "Failed");
      }
    } catch (err) {
      console.error(err);
    }

    setUpdatingStoreStatus(false);
  }, [API_BASE, fetchOrders, restaurant]);

  return {
    restaurant,
    updatingStoreStatus,
    fetchRestaurant,
    toggleStoreStatus
  };
}
