import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid'; 
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Icon Fix (Standard Leaflet Markers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 18, { animate: true, duration: 1.5 });
      setTimeout(() => { map.invalidateSize(); }, 400);
    }
  }, [position, map]);
  return null;
}

// ==========================================
// 🚀 LIVE ORDER TRACKING SCREEN (INJECTED)
// ==========================================
function OrderTrackingScreen({ orderId }) {
  const [order, setOrder] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const controller = new AbortController(); // 🚀 CHATGPT FIX: Prevent Fetch Memory Leaks
    
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order || data); 
        } else if (res.status === 401 || res.status === 403) {
          localStorage.clear();
          navigate('/login');
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error("Tracking fetch error", e);
      }
    };

    fetchOrder();
    // Polling is fine for MVP. Real-time scales later.
    const interval = setInterval(fetchOrder, 3000); 
    
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [orderId, navigate]);

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDF2F0]">
        <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="font-black text-orange-500 animate-pulse">Loading Live Tracking...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF2F0] p-4 md:p-8 font-sans flex flex-col items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-orange-100 animate-slide-up">
         <div className="bg-gray-900 p-8 text-center text-white">
            <h1 className="text-3xl font-black italic text-orange-500">Live Status 🍔</h1>
            <p className="font-bold text-gray-400 mt-2 tracking-widest uppercase text-[10px]">Order ID: #{order._id.substring(order._id.length - 6).toUpperCase()}</p>
         </div>
         
         <div className="p-8 flex flex-col items-center">
            {/* Live Status Indicator */}
            <div className="bg-orange-50 text-orange-600 px-6 py-2 rounded-full font-black text-lg mb-2 shadow-sm border border-orange-100">
               {order.status || 'Pending'}
            </div>
            
            <p className="text-xs font-bold text-gray-400 mb-8 text-center uppercase tracking-widest">
               {order.status === 'Pending' && "Waiting for restaurant to accept..."}
               {order.status === 'Accepted' && "Restaurant accepted! Finding a rider..."}
               {order.status === 'Confirmed' && "Restaurant confirmed! Finding a rider..."}
               {order.status === 'Cooking' && "Your food is being prepared! 👨‍🍳"}
               {order.status === 'Out for Delivery' && "Rider is on the way with your food! 🛵"}
               {order.status === 'Delivered' && "Order Delivered! Enjoy your meal! 🎉"}
            </p>

            {/* 🚀 THE VIP OTP BOX (SECURITY FIX INCLUDED) */}
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 w-full rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600"></div>
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Delivery PIN</p>
               
               {/* 🚀 CHATGPT SECURITY FIX: Only show OTP when status is Out for Delivery */}
               {order.status === 'Out for Delivery' && order.deliveryOTP ? (
                 <div className="bg-white border-2 border-orange-500 text-orange-500 px-10 py-4 rounded-2xl text-5xl font-mono font-black tracking-[0.4em] shadow-lg animate-pulse">
                    {order.deliveryOTP}
                 </div>
               ) : (
                 <div className="bg-gray-100 text-gray-400 border border-gray-200 px-8 py-5 rounded-2xl text-sm font-black tracking-widest uppercase flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-300 rounded-full animate-ping"></span> 
                    {order.status === 'Delivered' ? 'Delivered ✅' : 'Waiting for Rider'}
                 </div>
               )}
               
               <p className="text-[10px] font-bold text-gray-400 mt-5 text-center px-4">
                  Share this PIN with the rider <span className="text-red-500 font-black">ONLY</span> when they deliver your food.
               </p>
            </div>

            {/* Rider Info Card (Only shows if assigned) */}
            {order.assignedRiderId && order.assignedRiderId.name && (
               <div className="mt-8 w-full bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Your Rider</p>
                     <p className="font-black text-blue-900 text-lg">{order.assignedRiderId.name}</p>
                     {order.assignedRiderId.bikeNumber && (
                        <p className="text-[10px] font-bold text-blue-600">Bike: {order.assignedRiderId.bikeNumber}</p>
                     )}
                  </div>
                  <a href={`tel:${order.assignedRiderId.phone}`} className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full font-bold shadow-md hover:bg-blue-700 transition-all text-xl active:scale-95">
                     📞
                  </a>
               </div>
            )}

            <button onClick={() => navigate('/')} className="mt-10 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-orange-500 transition-colors">
               ← Back to Home
            </button>
         </div>
      </div>
    </div>
  );
}

// ==========================================
// ORIGINAL CHECKOUT COMPONENT
// ==========================================
function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();

  const cartItems = location.state?.cartItems || [];
  const restaurantId = location.state?.restaurantId || '';
  const foodTotal = location.state?.totalAmount || 0;

  // ⛽ CEO DYNAMIC PRICING STATES
  const [petrolPrice, setPetrolPrice] = useState(175); 
  const [deliveryFee, setDeliveryFee] = useState(25);  
  const [distance, setDistance] = useState(0);

  const [position, setPosition] = useState([27.5020, 83.6661]); 
  const [resCoords, setResCoords] = useState([27.5050, 83.6690]); 
  const [address, setAddress] = useState("Locating your hunger...");
  const [isLocating, setIsLocating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [clientOrderId] = useState(() => uuidv4()); 
  const markerRef = useRef(null);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const dist = calculateDistance(resCoords[0], resCoords[1], position[0], position[1]);
    setDistance(dist.toFixed(2));

    const fuelCostPerKM = petrolPrice / 40; 
    const riderProfitPerKM = 12; 
    
    let calculatedFee = (fuelCostPerKM + riderProfitPerKM) * dist;
    setDeliveryFee(calculatedFee < 25 ? 25 : Math.round(calculatedFee));
  }, [position, petrolPrice]);

  const grandTotal = foodTotal + deliveryFee;

  // 🚀 CHATGPT FIX: Added AbortController to prevent race conditions during reverse geocoding
  const fetchAddress = async (lat, lon, signal) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, { signal });
      const data = await response.json();
      setAddress(data.display_name || "Location Selected");
    } catch (error) { 
      if (error.name !== 'AbortError') console.error("Address Error", error); 
    }
  };

  // 🚀 CHATGPT FIX: Debouncing implementation for Map Dragging (Prevents API Ban)
  useEffect(() => {
    const controller = new AbortController();
    setAddress("Locating your hunger..."); // Show loading state
    
    const timeout = setTimeout(() => {
      fetchAddress(position[0], position[1], controller.signal);
    }, 700); // 700ms delay

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [position]);

  const findMyLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) { alert("Browser doesn't support GPS"); setIsLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => { alert("GPS Access Denied!"); setIsLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  function MapEventsHandler() {
    useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); } });
    return null;
  }

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setPosition([newPos.lat, newPos.lng]);
      }
    },
  }), []);

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return; // 🚀 CHATGPT FIX: Prevent Double Submit

    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    if (paymentMethod === 'Online') { alert("Online payment coming soon!"); return; }

    if (!restaurantId) {
      alert("⚠️ Error: Restaurant ID is missing! Please go back to the cart and try again.");
      return;
    }

    const safePhone = localStorage.getItem('userPhone') || localStorage.getItem('phone') || "Number Not Provided";

    const formattedItems = cartItems.map(item => ({
        menuItemId: item._id, 
        quantity: item.quantity || 1, 
        name: item.name
    }));

    setIsPlacingOrder(true);
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          restaurantId,
          items: formattedItems, 
          clientOrderId,        
          totalAmount: grandTotal,
          deliveryFee: deliveryFee, 
          deliveryDetails: { address, phone: safePhone, latitude: position[0], longitude: position[1] }
        }),
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {};
      }
      if (response.ok) { 
        const finalOrderId = data.order?._id || data.orderId || data._id;
        setPlacedOrderId(finalOrderId);
      } else { 
        alert(`Order Failed: ${data.error || data.message || "Unknown Error"}`); 
      } 
    } catch (error) { 
      alert("Network Error! Could not connect to the server."); 
    } finally { 
      setIsPlacingOrder(false); 
    }
  };

  if (placedOrderId) {
    return <OrderTrackingScreen orderId={placedOrderId} />;
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDF2F0] p-4 font-sans">
        <div className="bg-white rounded-[2.5rem] p-10 text-center shadow-2xl border border-orange-50">
          <h1 className="text-3xl font-black text-gray-900">Your Cart Is Empty</h1>
          <p className="text-gray-400 font-bold mt-3">Add some delicious items before checking out.</p>
          <button onClick={() => navigate('/')} className="mt-8 bg-orange-500 hover:bg-gray-900 text-white font-black py-4 px-8 rounded-2xl transition-all">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF2F0] p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-orange-500 font-black text-sm uppercase transition-all group">
            <span className="text-2xl group-hover:-translate-x-1">←</span> Back
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-orange-50">
          <div className="bg-gray-900 p-8 text-center text-white font-black italic">
            <h1 className="text-3xl">Delivery Details 📍</h1>
          </div>

          <div className="p-6 md:p-10">
            {/* Payment Selection */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button onClick={() => setPaymentMethod('COD')} className={`p-4 rounded-2xl border-2 transition-all font-bold ${paymentMethod === 'COD' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'}`}>💵 COD</button>
              <button onClick={() => setPaymentMethod('Online')} className={`p-4 rounded-2xl border-2 transition-all font-bold ${paymentMethod === 'Online' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'}`}>💳 Online</button>
            </div>

            {/* Price Breakdown Card */}
            <div className="bg-orange-50 p-6 rounded-3xl mb-6 border border-orange-100">
                <div className="flex justify-between mb-2">
                    <span className="font-bold text-gray-600">Food Total:</span>
                    <span className="font-black">NPR {foodTotal}</span>
                </div>
                <div className="flex justify-between text-orange-600 mb-4">
                    <span className="font-bold">Delivery ({distance} km):</span>
                    <span className="font-black">+ NPR {deliveryFee}</span>
                </div>
                <div className="border-t-2 border-orange-200 pt-4 flex justify-between text-xl">
                    <span className="font-black text-gray-900">Grand Total:</span>
                    <span className="font-black text-orange-600">NPR {grandTotal}</span>
                </div>
            </div>

            <button onClick={findMyLocation} className={`w-full py-4 rounded-xl font-black text-sm transition-all mb-4 uppercase ${isLocating ? 'bg-gray-400' : 'bg-gray-900 text-white hover:bg-orange-500'}`}>
              {isLocating ? "📡 SYNCING GPS..." : "🎯 Use My Current Location"}
            </button>

            <div style={{ height: '350px', width: '100%', position: 'relative' }} className="rounded-2xl overflow-hidden border-2 border-gray-100 z-0">
              <MapContainer center={position} zoom={18} maxZoom={24} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={24} />
                <MapEventsHandler />
                <RecenterMap position={position} />
                <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef} />
              </MapContainer>
            </div>

            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mt-8">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selected Address</label>
              <p className="font-bold text-gray-800 text-sm mt-2">{address}</p>
            </div>

            <button disabled={isPlacingOrder} onClick={handlePlaceOrder} className={`w-full mt-8 py-6 rounded-2xl font-black text-xl transition-all uppercase ${isPlacingOrder ? 'bg-gray-300' : 'bg-orange-500 hover:bg-gray-900 text-white shadow-xl shadow-orange-200'}`}>
              {isPlacingOrder ? "Placing Order..." : "Confirm Order ➔"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
