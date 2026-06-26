import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Custom Icons for Preview Map
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropoffIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function RiderHomeTab({ 
  isOnline, 
  isLoading, 
  orders, 
  currentTime, 
  handleAcceptOrder 
}) {
  const [previewOrder, setPreviewOrder] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null); 
  const [hiddenOrders, setHiddenOrders] = useState(new Set()); // 🚀 CHATGPT FIX: Optimistic Order Removal

  // 🚀 CHATGPT FIX: Safe PopState & Escape Key listener
  useEffect(() => {
    const handlePopState = () => setPreviewOrder(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewOrder(null);
        if (window.history.state?.previewModal) window.history.back();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 🚀 CHATGPT FIX: Safe Date Parsing & Memoized derived state
  const activeOrders = useMemo(() => {
    if (!orders) return [];
    
    return orders
      .filter(order => !hiddenOrders.has(order._id)) // Filter optimistically hidden orders
      .map(order => {
        // Safe Date Parsing
        const createdAtMs = order.createdAt ? new Date(order.createdAt).getTime() : null;
        const safeCreatedAt = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
        
        const expireTimeMs = order.offerExpiresAt ? new Date(order.offerExpiresAt).getTime() : null;
        const safeExpireTime = Number.isFinite(expireTimeMs) ? expireTimeMs : (safeCreatedAt + 60000);

        const diff = Math.floor((safeExpireTime - currentTime) / 1000);
        const secondsLeft = diff > 0 ? diff : 0;
        
        return { ...order, secondsLeft };
      })
      .filter(order => order.secondsLeft > 0);
  }, [orders, currentTime, hiddenOrders]);

  // 🚀 ENGINE SYNC: Safe modal trigger without infinite history stack
  const openPreview = useCallback((order) => {
    setPreviewOrder(order);
    if (!window.history.state?.previewModal) {
      window.history.pushState({ previewModal: true }, '');
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOrder(null);
    if (window.history.state?.previewModal) {
      window.history.back();
    }
  }, []);

  // 🚀 CHATGPT FIX: Safe Try/Catch/Finally for Async Accept Flow
  const onAcceptClick = useCallback(async (orderId) => {
    if (acceptingId) return; 

    try {
      setAcceptingId(orderId);
      await handleAcceptOrder(orderId);
      
      // Optimistically hide the order to prevent double-clicks or UI staleness
      setHiddenOrders(prev => new Set(prev).add(orderId));
      closePreview();
    } catch (err) {
      console.error('Accept order failed:', err);
    } finally {
      setAcceptingId(null);
    }
  }, [acceptingId, handleAcceptOrder, closePreview]);

  // Safe Coordinate Validator Function
  const getSafeCoords = (lat, lng, fallbackLat = 27.5050, fallbackLng = 83.6690) => {
    const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : fallbackLat;
    const safeLng = Number.isFinite(Number(lng)) ? Number(lng) : fallbackLng;
    return [safeLat, safeLng];
  };

  return (
    <div className="space-y-4 pb-20">
      {!isOnline ? (
        <div className="bg-white dark:bg-gray-900 py-16 px-4 rounded-3xl text-center shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="text-5xl mb-4 grayscale opacity-40">🛵</div>
          <p className="font-black text-gray-800 dark:text-gray-200 text-lg">You are Offline</p>
          <p className="text-sm text-gray-500 mt-2 font-medium max-w-xs mx-auto">Toggle the switch at the top to go online and start receiving orders in your area.</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-900 py-16 px-4 rounded-3xl text-center shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-bold text-orange-500 text-sm tracking-wide">Scanning for nearby orders...</p>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 py-16 px-4 rounded-3xl text-center shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 text-9xl opacity-5 grayscale">📡</div>
          <div className="text-5xl mb-4 relative z-10 animate-bounce">🍔</div>
          <p className="font-black text-gray-800 dark:text-gray-200 text-lg relative z-10">Searching your radar</p>
          <p className="text-sm text-gray-500 mt-2 font-medium max-w-xs mx-auto relative z-10">We will notify you instantly when a new order drops nearby.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-2">Incoming Requests</h3>
          
          {activeOrders.map((order) => {
            const isExpiring = order.secondsLeft <= 15; 
            
            return (
              <div key={order._id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-orange-200 dark:border-orange-500/30 flex flex-col md:flex-row md:items-center justify-between p-3 gap-3 transition-all hover:shadow-md">
                
                {/* Left Side: Shop Name & Dropoff Info */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0"></span>
                    <h4 className="text-base font-black text-gray-900 dark:text-white truncate leading-tight">
                      {order.restaurantId?.name || "Restaurant"}
                    </h4>
                  </div>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate pl-4">
                    Dropoff: {order.deliveryDetails?.address || "Location not provided"}
                  </p>
                </div>
                
                {/* Right Side: Inline Buttons (Task, Map, Timer, Accept) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar shrink-0 pl-4 md:pl-0">
                  
                  {/* 🚀 BLIND DISPATCH: Earnings Hidden */}
                  <span className="px-3 h-9 flex items-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-black text-xs rounded-lg border border-indigo-100 dark:border-indigo-500/20 whitespace-nowrap">
                    📦 Delivery
                  </span>

                  <button 
                    onClick={() => openPreview(order)}
                    aria-label="View route map"
                    className="px-3 h-9 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg hover:bg-blue-100 transition-colors border border-blue-100 dark:border-blue-500/20 whitespace-nowrap"
                  >
                    📍 Map
                  </button>

                  <div className={`px-3 h-9 flex items-center justify-center font-black text-xs rounded-lg border w-[60px] ${isExpiring ? 'bg-red-100 border-red-200 text-red-600 animate-pulse' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                    {order.secondsLeft}s
                  </div>
                  
                  <button 
                    onClick={() => onAcceptClick(order._id)}
                    disabled={acceptingId === order._id}
                    aria-label="Accept delivery order"
                    className={`text-white px-4 h-9 rounded-lg font-black text-xs transition-all shadow-sm shadow-orange-500/30 whitespace-nowrap ${
                      acceptingId === order._id ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'
                    }`}
                  >
                    {acceptingId === order._id ? '...' : 'Accept'}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 INJECTED: Preview Map Modal for Available Orders */}
      {previewOrder && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md overflow-hidden flex flex-col h-[70vh] shadow-2xl border border-gray-200 dark:border-gray-800 transition-all duration-300 transform scale-100">
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-black text-gray-900 dark:text-white">Route Preview</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Check distance before accepting</p>
              </div>
              <button 
                onClick={closePreview} 
                aria-label="Close map"
                className="app-close-btn w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 w-full relative z-0">
               <MapContainer 
                 center={getSafeCoords(previewOrder.restaurantId?.latitude, previewOrder.restaurantId?.longitude)} 
                 zoom={13} 
                 scrollWheelZoom={true} 
                 style={{ height: '100%', width: '100%' }}
               >
                 <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 
                 <Marker position={getSafeCoords(previewOrder.restaurantId?.latitude, previewOrder.restaurantId?.longitude)} icon={pickupIcon}>
                   <Popup>Pickup: {previewOrder.restaurantId?.name}</Popup>
                 </Marker>

                 <Marker 
                    position={getSafeCoords(
                        previewOrder.deliveryDetails?.latitude, 
                        previewOrder.deliveryDetails?.longitude, 
                        (previewOrder.restaurantId?.latitude || 27.5050) + 0.01, 
                        (previewOrder.restaurantId?.longitude || 83.6690) + 0.01
                    )} 
                    icon={dropoffIcon}
                 >
                   <Popup>Dropoff: {previewOrder.deliveryDetails?.address || "Dropoff"}</Popup>
                 </Marker>
               </MapContainer>
            </div>

            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={() => onAcceptClick(previewOrder._id)}
                disabled={!!acceptingId}
                className={`w-full text-white py-4 rounded-xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                  acceptingId ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 active:scale-95'
                }`}
              >
                {acceptingId ? 'Processing...' : 'Accept This Order Now'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default RiderHomeTab;