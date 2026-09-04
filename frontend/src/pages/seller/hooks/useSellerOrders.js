import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function useSellerOrders({
  API_BASE,
  enabled,
  myItems,
  onOrderCancelled
}) {
  const [orders, setOrders] = useState([]);
  const [riderOnTheWayNotification, setRiderOnTheWayNotification] = useState(null);

  const socketRef = useRef(null);
  const newOrderSoundRef = useRef(null);
  const riderAssignedSoundRef = useRef(null);
  const hasJoinedRoom = useRef(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/seller/orders`, {
        credentials: 'include'
      });

      const data = await res.json();

      if (res.ok) {
        setOrders(data.data || []);
      } else {
        console.error("Orders 400 Error:", data.error || "Restaurant Not Linked");
      }
    } catch (err) {
      console.error("Order fetch error:", err);
    }
  }, [API_BASE]);

  const updateOrderStatus = useCallback(
    async (orderId, newStatus, reason = '') => {
      try {
        const res = await fetch(`${API_BASE}/api/seller/orders/${orderId}/status`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newStatus,
            ...(newStatus === 'Cancelled' ? { reason: reason.trim() } : {})
          })
        });

        if (res.ok) {
          setOrders(prevOrders => prevOrders.map(order =>
            order._id === orderId
              ? {
                  ...order,
                  status: newStatus,
                  ...(newStatus === 'Cancelled'
                    ? { cancellationReason: reason.trim() }
                    : {})
                }
              : order
          ));

          if (newStatus === 'Cancelled') {
            onOrderCancelled?.();
          }
        } else {
          console.error("Failed to update order status.");
        }
      } catch {
        console.error("Failed to update status.");
      }
    },
    [API_BASE, onOrderCancelled]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    newOrderSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    riderAssignedSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    socketRef.current = io(API_BASE, {
      withCredentials: true,
      transports: ["websocket"]
    });

    const socket = socketRef.current;

    setTimeout(() => {
      fetchOrders();
    }, 0);

    socket.on('newLiveOrder', (newOrder) => {
      console.log("New Order Received:", newOrder);
      setOrders((prevOrders) => [newOrder, ...prevOrders]);

      if (Notification.permission === "granted") {
        new Notification(`NEW ORDER!`, {
          body: `Customer: ${newOrder.customerId?.name || 'Guest'}`
        });
      }

      try {
        newOrderSoundRef.current.play();
      } catch {
        console.log("Sound play blocked by browser");
      }
    });

    socket.on('orderAssignedToRider', (data) => {
      console.log("Rider Assigned:", data);

      setOrders((prevOrders) => prevOrders.map(order => {
        if (order._id === data.orderId) {
          return {
            ...order,
            status: 'Preparing',
            assignedRiderId: {
              name: data.riderName,
              phone: data.riderPhone,
              bikeNumber: data.riderBike,
              distance: data.distance
            }
          };
        }

        return order;
      }));

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('Rider Assigned', {
          body: `Rider ${data.riderName || 'Rider'} has been assigned to this order.`
        });
      }

      try {
        riderAssignedSoundRef.current.play();
      } catch {
        console.log("Sound play blocked by browser");
      }
    });

    socket.on('riderOnTheWay', (data) => {
      setRiderOnTheWayNotification(data);

      setOrders((prevOrders) => prevOrders.map(order => {
        if (order._id === data.orderId) {
          return {
            ...order,
            riderOnTheWayAt: data.riderOnTheWayAt
          };
        }

        return order;
      }));

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('Rider On The Way', {
          body: 'The assigned rider has started moving toward the restaurant.'
        });
      }
    });

    socket.on('connect', () => console.log("Connected to Live Server"));

    return () => {
      if (socketRef.current) {
        socketRef.current.off('newLiveOrder');
        socketRef.current.off('orderAssignedToRider');
        socketRef.current.off('riderOnTheWay');
        socketRef.current.disconnect();
      }

      socketRef.current = null;
      newOrderSoundRef.current = null;
      riderAssignedSoundRef.current = null;
      hasJoinedRoom.current = false;
    };
  }, [API_BASE, enabled, fetchOrders]);

  useEffect(() => {
    if (!enabled || !socketRef.current || hasJoinedRoom.current) {
      return;
    }

    let activeRestId = null;

    if (orders.length > 0) {
      activeRestId = orders[0].restaurantId;
    } else if (myItems.length > 0) {
      activeRestId = myItems[0].restaurantId;
    }

    if (activeRestId) {
      console.log("Joining Restaurant Room:", activeRestId);
      socketRef.current.emit('joinRestaurantDashboard', activeRestId);
      hasJoinedRoom.current = true;
    }
  }, [enabled, orders, myItems]);

  return {
    orders,
    fetchOrders,
    updateOrderStatus,
    riderOnTheWayNotification,
    setRiderOnTheWayNotification
  };
}
