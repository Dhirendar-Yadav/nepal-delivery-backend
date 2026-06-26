import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

function RiderOrdersTab({ 
  activeOrder, 
  deliveryStatus, 
  handlePickedUp, 
  handleDelivered 
}) {
  const [showMap, setShowMap] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);

  // 🚀 CHATGPT FIX: Simplified Escape Key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowMap(false);
        setShowOtpModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 🚀 CHATGPT FIX: Prevent background scrolling when a modal is open
  useEffect(() => {
    const hasModalOpen = showMap || showOtpModal;
    document.body.style.overflow = hasModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMap, showOtpModal]);

  const openMap = () => setShowMap(true);
  const closeMap = () => setShowMap(false);
  
  const openOtp = () => setShowOtpModal(true);
  const closeOtp = () => {
    setShowOtpModal(false);
    setOtpError('');
    setOtpInput('');
  };

  // 🚀 CHATGPT FIX: Safe Async Error Handling
  const onPickedUpClick = async () => {
    if (isPickingUp) return;
    setIsPickingUp(true);
    try {
      await handlePickedUp();
    } catch (error) {
      console.error('Pickup failed:', error);
      alert("Network error. Please try again.");
    } finally {
      setIsPickingUp(false);
    }
  };

  const submitDeliveryOtp = async () => {
    if (otpInput.length < 4) {
      setOtpError("Enter 4-digit OTP");
      return;
    }
    setIsVerifying(true);
    setOtpError('');
    
    let result;
    try {
      result = await handleDelivered(otpInput);
    } catch (error) {
      setIsVerifying(false);
      setOtpError('Network error. Please try again.');
      return;
    }
    
    setIsVerifying(false);
    if (result && result.success) {
      closeOtp();
      // Using native alert as a reliable fallback since we are avoiding adding new libraries like react-hot-toast
      alert("✅ Delivery Successful! Wallet Updated.");
    } else {
      setOtpError(result?.message || "Invalid OTP. Please try again.");
    }
  };

  const sanitizePhone = (phone = '') => phone.replace(/[^\d+]/g, '');

  if (!activeOrder) {
    return (
      <div className="bg-white dark:bg-gray-900 py-16 px-4 rounded-3xl text-center shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="text-5xl mb-4 grayscale opacity-40">📦</div>
        <p className="font-black text-gray-800 dark:text-gray-200 text-lg">No Active Orders</p>
        <p className="text-sm text-gray-500 mt-2 font-medium max-w-xs mx-auto">Go to the Home tab to accept new deliveries.</p>
      </div>
    );
  }

  // 🚀 CHATGPT FIX: Strict Geographic Coordinate Validation
  const isValidLatitude = (lat) => {
    const num = Number(lat);
    return Number.isFinite(num) && num >= -90 && num <= 90;
  };
  const isValidLongitude = (lng) => {
    const num = Number(lng);
    return Number.isFinite(num) && num >= -180 && num <= 180;
  };
  const getSafeCoords = (lat, lng, fallbackLat = 27.5050, fallbackLng = 83.6690) => {
    const safeLat = isValidLatitude(lat) ? Number(lat) : fallbackLat;
    const safeLng = isValidLongitude(lng) ? Number(lng) : fallbackLng;
    return [safeLat, safeLng];
  };

  const pickupCoords = getSafeCoords(activeOrder.restaurantId?.latitude, activeOrder.restaurantId?.longitude);
  const dropoffCoords = getSafeCoords(
      activeOrder.deliveryDetails?.latitude, 
      activeOrder.deliveryDetails?.longitude, 
      pickupCoords[0] + 0.01, 
      pickupCoords[1] + 0.01
  );

  const centerPoint = deliveryStatus === 'pickup' ? pickupCoords : dropoffCoords;
  // 🚀 CHATGPT FIX: Secure HTTPS protocol
  const mapsLink = `https://maps.google.com/?q=${centerPoint[0]},${centerPoint[1]}`;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-2">Active Orders List</h3>
      
      {/* THIN LIST ROW DESIGN */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row items-center justify-between p-3 gap-4 transition-all hover:shadow-md">
        
        {/* Left Side: Order Info */}
        <div className="flex flex-col w-full lg:w-auto">
          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
            {deliveryStatus === 'pickup' ? 'Pickup' : 'Deliver To'} • #{activeOrder._id.slice(-6).toUpperCase()}
          </span>
          <span className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">
            {deliveryStatus === 'pickup' ? activeOrder.restaurantId?.name : activeOrder.customerId?.name || 'Customer'}
          </span>
        </div>

        {/* Right Side: Action Buttons in a line */}
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
          
          <a 
            href={`tel:${sanitizePhone(deliveryStatus === 'pickup' ? activeOrder.restaurantId?.phone : activeOrder.deliveryDetails?.phone)}`} 
            aria-label="Call customer or restaurant"
            className="w-9 h-9 shrink-0 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center text-sm hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-500/20"
            title="Call"
          >
            📞
          </a>

          <button 
            onClick={openMap} 
            aria-label="Open Map Modal"
            className="px-3 h-9 shrink-0 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100 border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5"
          >
            📍 Map
          </button>

          <a 
            href={mapsLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            aria-label="Navigate with Google Maps"
            className="px-3 h-9 shrink-0 bg-gray-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-50 border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5"
          >
            ↗️ Navigate
          </a>

          {deliveryStatus === 'pickup' ? (
            <button 
              onClick={onPickedUpClick} 
              disabled={isPickingUp}
              aria-label="Mark order as picked up"
              className={`px-4 h-9 shrink-0 text-white rounded-lg text-xs font-black transition-colors shadow-sm whitespace-nowrap ${isPickingUp ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
            >
              {isPickingUp ? 'Processing...' : '✅ Picked Up'}
            </button>
          ) : (
            <button 
              onClick={openOtp} 
              aria-label="Open Delivery OTP Modal"
              className="px-4 h-9 shrink-0 bg-orange-500 text-white rounded-lg text-xs font-black hover:bg-orange-600 transition-colors shadow-sm active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
            >
              🔒 Deliver (OTP)
            </button>
          )}
        </div>
      </div>

      {showMap && (
        <div 
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeMap} // 🚀 CHATGPT FIX: Close on Backdrop Click
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[70vh] shadow-2xl border border-gray-200 dark:border-gray-800 animate-slide-up"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside modal
          >
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-black text-gray-900 dark:text-white">Delivery Route</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Follow the map to your destination</p>
              </div>
              <button 
                onClick={closeMap} 
                aria-label="Close Map Modal"
                className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 w-full relative z-0">
               <MapContainer center={centerPoint} zoom={15} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                 <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 {deliveryStatus === 'pickup' && (
                   <Marker position={pickupCoords} icon={pickupIcon}>
                     <Popup>Pickup: {activeOrder.restaurantId?.name}</Popup>
                   </Marker>
                 )}
                 {deliveryStatus === 'dropoff' && (
                   <Marker position={dropoffCoords} icon={dropoffIcon}>
                     <Popup>Dropoff: {activeOrder.deliveryDetails?.address}</Popup>
                   </Marker>
                 )}
               </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div 
          className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0 md:pb-4"
          onClick={closeOtp} // 🚀 CHATGPT FIX: Close on Backdrop Click
        >
          <div 
            className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 shadow-2xl border-t border-gray-200 dark:border-gray-800 animate-slide-up transition-all"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside modal
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Enter Delivery OTP</h3>
              <button onClick={closeOtp} aria-label="Close OTP Modal" className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:bg-gray-200 transition-colors font-bold flex items-center justify-center">✕</button>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
              Ask <span className="font-bold text-gray-900 dark:text-gray-200">{activeOrder.customerId?.name || 'the customer'}</span> for the 4-digit PIN.
            </p>

            <div className="flex flex-col items-center gap-4 mb-6">
              <input 
                type="text" 
                maxLength="4" 
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ''));
                  setOtpError('');
                }}
                autoFocus
                placeholder="0000" 
                className={`w-40 text-center bg-gray-50 dark:bg-gray-950 border-2 ${otpError ? 'border-red-500 animate-pulse' : 'border-gray-300 dark:border-gray-700'} text-gray-900 dark:text-white py-4 rounded-xl text-3xl tracking-[0.5em] font-mono outline-none focus:border-orange-500 transition-colors`} 
              />
              {otpError && <p className="text-red-500 text-xs font-bold">{otpError}</p>}
            </div>

            <button 
              onClick={submitDeliveryOtp} 
              disabled={isVerifying || otpInput.length < 4}
              aria-label="Submit Delivery OTP"
              className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 ${isVerifying || otpInput.length < 4 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-green-500/30 active:scale-[0.98]'}`}
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Verifying PIN...
                </>
              ) : '✅ Complete Delivery'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RiderOrdersTab;