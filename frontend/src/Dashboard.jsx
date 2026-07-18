import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';

function Dashboard() {
  const navigate = useNavigate();
  const restaurantName = localStorage.getItem('userName') || "My Restaurant";

  const [orders, setOrders] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [restaurant, setRestaurant] = useState(null);
  const [updatingStoreStatus, setUpdatingStoreStatus] = useState(false);
  
  // 🚀 CHATGPT FIX: Use useRef for Socket and Audio to prevent memory leaks and infinite loops
  const socketRef = useRef(null);
  const newOrderSoundRef = useRef(null);
  const riderAssignedSoundRef = useRef(null);
  const hasJoinedRoom = useRef(false); // To prevent multiple room joins

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('token');
    
    if (role !== 'Seller' || !token) {
      navigate('/seller/login');
      return;
    }

    // Initialize Audio Objects ONCE
    newOrderSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    riderAssignedSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    
    // Ask for Browser Notification Permission
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    // 🚀 CHATGPT FIX: Initialize Socket ONCE
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";

socketRef.current = io(API_BASE, {
  auth: { token },
  transports: ["websocket"]
});

    fetchOrders(token);
    fetchMyMenu(token);
    fetchRestaurant(token);

    socketRef.current.on('newLiveOrder', (newOrder) => {
      console.log("🔥 New Order Received:", newOrder);
      // 🚀 CHATGPT FIX: Functional State Update
      setOrders((prevOrders) => [newOrder, ...prevOrders]);
      
      // 🚀 CHATGPT FIX: Removed blocking alert(), using native Notification
      if (Notification.permission === "granted") {
        new Notification(`🛎️ NEW ORDER!`, { body: `Customer: ${newOrder.customerId?.name || 'Guest'}` });
      }

      try {
        newOrderSoundRef.current.play();
      } catch (e) { console.log("Sound play blocked by browser"); }
    });

    socketRef.current.on('orderAssignedToRider', (data) => {
      console.log("🛵 Rider Assigned:", data);
      
      setOrders((prevOrders) => prevOrders.map(order => {
        if (order._id === data.orderId) {
          return { 
            ...order, 
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

      try {
        riderAssignedSoundRef.current.play();
      } catch (e) { console.log("Sound play blocked by browser"); }
    });

    socketRef.current.on('connect', () => console.log("🛰️ Connected to Live Server"));

    // Cleanup on Unmount
    return () => {
        if (socketRef.current) {
            socketRef.current.off('newLiveOrder');
            socketRef.current.off('orderAssignedToRider');
            socketRef.current.disconnect();
        }
    };
  }, [navigate]);

  // 🚀 CHATGPT FIX: Stable Room Joiner Logic
  useEffect(() => {
    if (socketRef.current && !hasJoinedRoom.current) {
      let activeRestId = null;
      if (orders.length > 0) activeRestId = orders[0].restaurantId;
      else if (myItems.length > 0) activeRestId = myItems[0].restaurantId;

      if (activeRestId) {
        console.log("📍 Joining Restaurant Room:", activeRestId);
        socketRef.current.emit('joinRestaurantDashboard', activeRestId);
        hasJoinedRoom.current = true; // Mark as joined to prevent loop
      }
    }
  }, [orders, myItems]);

  const fetchOrders = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/seller/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data.data || []);
      } else {
        console.error("Orders 400 Error:", data.error || "Restaurant Not Linked");
      }
    } catch (err) { console.error("Order fetch error:", err); }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/seller/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        // 🚀 CHATGPT FIX: Functional State Update to prevent stale data
        setOrders(prevOrders => prevOrders.map(order => 
            order._id === orderId ? { ...order, status: newStatus } : order
        ));
      }
    } catch (err) { console.error("Failed to update status."); }
  };

  const fetchMyMenu = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/api/seller/menu`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMyItems(data);
      } else {
        console.error("Menu 400 Error:", data.error || "Restaurant Not Linked");
      }
    } catch (error) { console.error("Menu fetch error:", error); }
  };
  const fetchRestaurant = async (token) => {
  try {
    const response = await fetch(
`${API_BASE}/api/seller/store`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
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
};

  const handleAddItem = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api/seller/menu`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
            name: itemName, 
            price: Number(itemPrice), 
            description: itemDescription 
        })
      });
      
      if (response.ok) {
        setItemName(''); setItemPrice(''); setItemDescription('');
        fetchMyMenu(token); 
        // Replaced alert with Notification for better UX
        if (Notification.permission === "granted") {
            new Notification(`✅ Item Added!`, { body: `${itemName} is now live.` });
        }
      } else {
        const errorData = await response.json();
        console.error(`Failed: ${errorData.error || errorData.message || "Invalid Data"}`);
      }
    } catch (error) { 
        console.error("Network Error: Make sure backend is running."); 
    }
  };
  const toggleStoreStatus = async () => {
  if (!restaurant) return;

  const token = localStorage.getItem('token');

  setUpdatingStoreStatus(true);

  try {
    const response = await fetch(
      `${API_BASE}/api/seller/store/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isOpen: !restaurant.isOpen
        })
      }
    );

    const data = await response.json();

    if (response.ok) {
      setRestaurant(data.restaurant);
      fetchOrders(token);
    } else {
      alert(data.error || "Failed");
    }

  } catch (err) {
    console.error(err);
  }

  setUpdatingStoreStatus(false);
};

  const handleLogout = () => {
    localStorage.clear(); 
    navigate('/seller/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans pb-20">
      
      {/* 🧭 Top Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700 py-4 px-8 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-gray-400 hover:text-orange-500 flex items-center gap-2 font-bold transition-colors bg-gray-900 px-4 py-2 rounded-xl">
            ⬅ <span className="hidden sm:inline">Back to App</span>
          </Link>
          
          <div className="border-l border-gray-700 pl-6">
            <h1 className="text-2xl font-black text-orange-500 tracking-tight">{restaurantName} 🏪</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Partner Dashboard</p>
          </div>
        </div>

        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm">
          LOGOUT
        </button>
      </nav>

      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-12">
        {/* ================= STORE STATUS ================= */}

<div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 flex justify-between items-center">

  <div>
    <h2 className="text-2xl font-black">
      Store Status
    </h2>

    <p className="text-gray-400 mt-1">
      {restaurant?.isOpen
        ? "Customers can place new orders."
        : "Store is currently closed."}
    </p>
  </div>

  <button
    disabled={updatingStoreStatus}
    onClick={toggleStoreStatus}
    className={`px-6 py-3 rounded-xl font-black transition ${
      restaurant?.isOpen
        ? "bg-green-600 hover:bg-green-700"
        : "bg-red-600 hover:bg-red-700"
    }`}
  >
    {updatingStoreStatus
      ? "Updating..."
      : restaurant?.isOpen
      ? "OPEN"
      : "CLOSED"}
  </button>

</div>
        {/* ================= SECTION 1: LIVE ORDERS ================= */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-3xl font-black text-white">Live Orders 🛎️</h2>
            <span className="bg-orange-500/20 text-orange-400 px-4 py-2 rounded-lg font-bold text-sm border border-orange-500/30">
              {orders.length} Total
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-gray-800 p-12 text-center rounded-[2rem] border border-gray-700">
              <p className="text-6xl mb-4 grayscale opacity-50">😴</p>
              <h3 className="text-2xl font-black text-gray-300">No orders yet</h3>
              <p className="text-gray-500 font-medium mt-2">Keep your kitchen ready! Orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {orders.map(order => (
                <div key={order._id} className="bg-gray-800 p-6 rounded-[2rem] shadow-xl border border-gray-700 relative overflow-hidden transition-all hover:border-orange-500/50">
                  
                  <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl font-black text-xs uppercase tracking-wider text-white ${
                    order.status === 'Pending' ? 'bg-red-500 animate-pulse' : order.status === 'Cooking' ? 'bg-orange-500' : 'bg-green-500'
                  }`}>
                    {order.status}
                  </div>

                  <div className="mb-4 pr-24">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Order ID: #{order._id.substring(order._id.length - 6)}</p>
                    <h3 className="text-xl font-black text-white">Customer: {order.customerId?.name || "Guest"}</h3>
                    <p className="text-sm font-bold text-orange-400 mt-1">📞 {order.customerId?.phone || order.deliveryDetails?.phone}</p>
                  </div>

                  <div className="bg-gray-900 p-4 rounded-2xl mb-6 border border-gray-700">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items to Cook:</p>
                    <ul className="space-y-2">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between font-bold text-gray-300 text-sm">
                          <span>{item.quantity}x {item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.assignedRiderId && (
                    <div className="bg-gray-900 p-4 rounded-2xl mb-6 border border-blue-500/30 flex justify-between items-center">
                       <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Rider Assigned 🛵</p>
                          <h4 className="text-lg font-black text-white">{order.assignedRiderId.name}</h4>
                          <p className="text-sm font-bold text-blue-400">📞 {order.assignedRiderId.phone}</p>
                       </div>
                       <div className="text-right bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20">
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Status</p>
                          <p className="text-sm font-black text-white animate-pulse">On the way 📍</p>
                       </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t border-gray-700 pt-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">Your Earning</p>
                      <p className="text-2xl font-black text-green-400">NPR {order.foodCost}</p>
                    </div>
                    
                    <div className="flex flex-col items-end">
                        {order.status === 'Pending' && (
                        <button onClick={() => updateOrderStatus(order._id, 'Confirmed')} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all">
                            Accept Order ✅
                        </button>
                        )}
                        
                        {(order.status === 'Confirmed' || order.status === 'Accepted') && !order.assignedRiderId && (
                        <div className="text-right">
                            <p className="text-sm text-gray-400 font-bold animate-pulse mb-2">📡 Finding Nearest Rider...</p>
                            <button disabled className="bg-gray-600 text-gray-400 px-6 py-3 rounded-xl font-black shadow-lg cursor-not-allowed">
                            Start Cooking 👨‍🍳
                            </button>
                        </div>
                        )}

                        {(order.status === 'Confirmed' || order.status === 'Accepted' || order.status === 'Out for Delivery') && order.assignedRiderId && order.status !== 'Cooking' && (
                        <button onClick={() => updateOrderStatus(order._id, 'Cooking')} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all animate-bounce">
                            Start Cooking 👨‍🍳
                        </button>
                        )}

                        {order.status === 'Cooking' && (
                        <button onClick={() => updateOrderStatus(order._id, 'Out for Delivery')} className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all">
                            Food Ready ✅
                        </button>
                        )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-gray-800 border-2 rounded-full" />

        {/* ================= SECTION 2: MENU MANAGEMENT ================= */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-3xl font-black text-white">Menu Management 🍽️</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-8 rounded-[2rem] border border-gray-700 shadow-xl h-fit">
              <h3 className="text-xl font-bold mb-6 text-orange-400 border-b border-gray-700 pb-4">Add New Menu Item</h3>
              <form onSubmit={handleAddItem} className="space-y-5">
                <div>
                  <label className="block text-gray-400 mb-2 font-medium text-sm">Item Name</label>
                  <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-orange-500 outline-none" placeholder="e.g. Chicken Steam Momo" required />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2 font-medium text-sm">Price (NPR)</label>
                  <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-orange-500 outline-none" placeholder="150" required min="0" />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2 font-medium text-sm">Description</label>
                  <textarea value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-orange-500 outline-none" rows="3" placeholder="Delicious hot momos..." required ></textarea>
                </div>
                <button type="submit" className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wide">
                  Publish to Network ➔
                </button>
              </form>
            </div>

            <div className="bg-gray-800 p-8 rounded-[2rem] border border-gray-700 shadow-xl h-fit max-h-[600px] overflow-y-auto custom-scrollbar">
              <h3 className="text-xl font-bold mb-6 text-orange-400 border-b border-gray-700 pb-4">Active Menu ({myItems.length})</h3>
              {myItems.length === 0 ? (
                <p className="text-gray-500 text-center py-10 font-medium">Your menu is currently empty.</p>
              ) : (
                <div className="space-y-4">
                  {myItems.map(item => (
                    <div key={item._id} className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex justify-between items-center hover:border-orange-500 transition-all">
                      <div>
                        <h4 className="text-lg font-bold text-white">{item.name}</h4>
                        <p className="text-orange-400 font-bold text-sm">NPR {item.price}</p>
                      </div>
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-md text-xs font-bold border border-green-500/30">
                        Live
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
