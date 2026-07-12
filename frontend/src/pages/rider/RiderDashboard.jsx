import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

import RiderHomeTab from '../../components/rider/RiderHomeTab';
import RiderWalletTab from '../../components/rider/RiderWalletTab';
import RiderProfileTab from '../../components/rider/RiderProfileTab';
import RiderOrdersTab from '../../components/rider/RiderOrdersTab';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Centralized Auth Fetch to handle Token Expiry (401)
const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    if (typeof window !== 'undefined' && window.__riderDashboardNavigateToLogin) {
      window.__riderDashboardNavigateToLogin();
    } else {
      window.location.href = '/login';
    }
    return null; 
  }
  return res;
};

function RiderDashboard() {
  const [orders, setOrders] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('home'); 
  
  const [activeOrder, setActiveOrder] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('pickup'); 

  const [newOrderToast, setNewOrderToast] = useState(null);

  const [isToggling, setIsToggling] = useState(false);
  const controllerRef = useRef(null);
  const acceptingRef = useRef(false);
  const toggleInFlightRef = useRef(false);
  
  const isOnlineRef = useRef(isOnline);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  const lastLocationRef = useRef(null);
  const lastOrderIdRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const [riderDetails, setRiderDetails] = useState({
    bikeNumber: 'Loading...',
    licenseNumber: 'Loading...',
    citizenshipNo: 'Loading...',
    phone: 'Loading...',
    email: 'Loading...',
    citizenshipFront: null,
    citizenshipBack: null,
    licenseFront: null,
    bluebookDoc: null,
    isVerified: false
  });
  const [walletBalance, setWalletBalance] = useState(0);

  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [shiftDuration, setShiftDuration] = useState('00:00:00');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const activeTabRef = useRef(activeTab);
  const showLogoutConfirmRef = useRef(showLogoutConfirm);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { showLogoutConfirmRef.current = showLogoutConfirm; }, [showLogoutConfirm]);

  const navigate = useNavigate();
  const riderName = localStorage.getItem('userName') || 'Rider';

  useEffect(() => {
    window.__riderDashboardNavigateToLogin = () => {
      navigate('/login', { replace: true });
    };

    return () => {
      delete window.__riderDashboardNavigateToLogin;
    };
  }, [navigate]);

  const handleTabSwitch = useCallback((newTab) => {
    if (activeTabRef.current === newTab) return;
    setActiveTab(newTab);
    window.history.replaceState(null, "", `#${newTab}`);
  }, []);

  // Initial Load Hash Setup
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (['home', 'orders', 'wallet', 'profile'].includes(hash)) {
      setActiveTab(hash);
    } else {
      window.history.replaceState(null, "", "#home");
      setActiveTab('home');
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const closeBtns = document.querySelectorAll('.app-close-btn');
      if (closeBtns.length > 0) {
        closeBtns[closeBtns.length - 1].click();
        return;
      }

      const isImageModalOpen = document.getElementById('image-preview-modal');
      const isOrderMapOpen = document.getElementById('order-map-modal');
      if (isImageModalOpen || isOrderMapOpen) {
        return;
      }

      if (showLogoutConfirmRef.current) {
        setShowLogoutConfirm(false);
        return;
      }

      const currentHash = window.location.hash.replace('#', '');
      if (currentHash && ['home', 'orders', 'wallet', 'profile'].includes(currentHash)) {
        setActiveTab(currentHash);
      } else {
        window.history.replaceState(null, '', '#home');
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchActiveOrder = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/rider/orders/active`);
      if (res && res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          setActiveOrder(data.order);
          setDeliveryStatus(data.deliveryStatus || data.order.deliveryStatus || 'pickup'); 
        }
      }
    } catch (err) {
      console.error("Active order sync failed:", err);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/rider/profile`);
      
      if (res && res.ok) {
        const data = await res.json();
        setRiderDetails({
          bikeNumber: data.bikeNumber || 'Not Provided',
          licenseNumber: data.licenseNumber || 'Not Provided',
          citizenshipNo: data.citizenshipNo || 'Not Provided',
          phone: data.phone || 'Not Provided',
          email: data.email || 'Not Provided',
          citizenshipFront: data.citizenshipFront || null,
          citizenshipBack: data.citizenshipBack || null,
          licenseFront: data.licenseFront || null,
          bluebookDoc: data.bluebookDoc || null,
          isVerified: data.isVerified || false
        });
        setWalletBalance(data.walletBalance || 0);
        
        if (data.isOnline !== undefined) setIsOnline(data.isOnline);
        if (data.shiftStartTime) setShiftStartTime(data.shiftStartTime);
      }
    } catch (err) { 
        console.error("Network Error during Profile Fetch:", err); 
    } finally {
        setIsLoading(false);
    }
  }, []);

  const fetchAvailableOrders = useCallback(async () => {
    if (!isOnlineRef.current) return;
    
    if (controllerRef.current) {
      controllerRef.current.abort(); 
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    
    try {
      const res = await authFetch(`${API_BASE}/api/rider/orders/available`, {
        signal: controller.signal
      });
      if (res && res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : (data.orders ?? []));
      }
    } catch (err) { 
        if (err.name !== 'AbortError') {
          console.error("Error fetching orders"); 
        }
    } finally { 
        setIsLoading(false); 
    }
  }, []);

  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; 
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const refreshDashboard = useCallback(() => {
    fetchProfile();
    fetchActiveOrder();
    if (isOnlineRef.current) {
      fetchAvailableOrders();
    }
  }, [fetchProfile, fetchActiveOrder, fetchAvailableOrders]);

  useEffect(() => {
    let watchId;
    if (isOnline && navigator.geolocation) {
      const geoOptions = { 
        enableHighAccuracy: activeOrder ? true : false, 
        maximumAge: activeOrder ? 10000 : 20000, 
        timeout: 5000 
      };

      const MIN_LOCATION_DISTANCE_METERS = 50;
      const MIN_LOCATION_INTERVAL_MS = 15000;

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          if (activeOrder) {
            let shouldUpdate = true;
            const now = Date.now();

            if (lastLocationRef.current) {
              const distance = getDistanceMeters(lastLocationRef.current.lat, lastLocationRef.current.lng, latitude, longitude);
              if (distance < MIN_LOCATION_DISTANCE_METERS) shouldUpdate = false;
            }

            if (shouldUpdate && (now - lastUpdateTimeRef.current > MIN_LOCATION_INTERVAL_MS)) {
              lastUpdateTimeRef.current = now;
              lastLocationRef.current = { lat: latitude, lng: longitude };
              
              try {
                await authFetch(`${API_BASE}/api/rider/update-location`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: activeOrder._id,
                    latitude,
                    longitude
                  })
                });
              } catch (err) {
                console.error("Failed to sync live location");
              }
            }
          }
        },
        (error) => {
          console.error("GPS Error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            // TODO: Replace with app toast/snackbar.
          }
        },
        geoOptions
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, activeOrder]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(new Date());
      if (isOnline && shiftStartTime) {
        const now = new Date();
        const start = new Date(shiftStartTime);
        const diff = Math.floor((now - start) / 1000); 
        const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        setShiftDuration(`${hrs}:${mins}:${secs}`);
      } else {
        setShiftDuration('00:00:00');
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [isOnline, shiftStartTime]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socketRef.current = io(API_BASE, { 
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    const socket = socketRef.current;

    const handleConnect = () => {
      setIsSocketConnected(true);
      fetchProfile();
      if (isOnlineRef.current) {
        fetchAvailableOrders();
        fetchActiveOrder();
      }
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    const handleNewOrder = (orderData) => {
      if (!isOnlineRef.current) return; 

      if (lastOrderIdRef.current === orderData._id) return;
      lastOrderIdRef.current = orderData._id;

      setNewOrderToast(orderData);
      fetchAvailableOrders(); 
      setTimeout(() => setNewOrderToast(null), 5000);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('newOrderOffer', handleNewOrder);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('newOrderOffer', handleNewOrder);
      socket.disconnect(); 
    };
  }, [fetchAvailableOrders, fetchActiveOrder, fetchProfile]);

  useEffect(() => {
    fetchProfile();
    fetchActiveOrder(); 
  }, [fetchProfile, fetchActiveOrder]); 

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile();
      }
    };

    const handleWindowFocus = () => {
      fetchProfile();
    };

    const handleOnline = () => {
      fetchProfile();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (isOnline && !activeOrder) {
      fetchAvailableOrders();
      let interval;
      if (!isSocketConnected) {
        interval = setInterval(fetchAvailableOrders, 10000);
      }
      return () => { if (interval) clearInterval(interval); };
    } else {
      setOrders([]); 
      setIsLoading(false);
    }
  }, [isOnline, activeOrder, isSocketConnected, fetchAvailableOrders]);

  const handleToggleOnline = useCallback(async () => {
    if (activeOrder) return; // TODO: Replace with app toast/snackbar.
    if (isToggling || toggleInFlightRef.current) return;

    toggleInFlightRef.current = true;
    setIsToggling(true);
    const newStatus = !isOnline;

    try {
        const res = await authFetch(`${API_BASE}/api/rider/toggle-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetStatus: newStatus })
        });
        
        if (res && res.ok) {
            const data = await res.json();
            if (data.success) {
                setIsOnline(newStatus); 
                if (newStatus) {
                    setShiftStartTime(data.shiftStartTime || new Date().toISOString()); 
                    fetchAvailableOrders();
                } else {
                    setShiftStartTime(null); 
                    setOrders([]); 
                }
            } else {
                // TODO: Replace with app toast/snackbar.
            }
        }
    } catch (error) { 
        // TODO: Replace with app toast/snackbar.
    } finally {
        toggleInFlightRef.current = false;
        setIsToggling(false); 
    }
  }, [activeOrder, isOnline, isToggling, fetchAvailableOrders]);

  const handleAcceptOrder = useCallback(async (orderId) => {
    if (!isOnline) return; // TODO: Replace with app toast/snackbar.
    if (acceptingRef.current) return;
    acceptingRef.current = true;

    try {
      const res = await authFetch(`${API_BASE}/api/rider/orders/${orderId}/accept`, {
        method: 'PUT'
      });
      
      if (res && res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          setActiveOrder(data.order);
          setDeliveryStatus(data.deliveryStatus || data.order.deliveryStatus || 'pickup');
          handleTabSwitch('orders'); 
        }
        fetchAvailableOrders();
      } else if (res) {
        const data = await res.json();
        // TODO: Replace with app toast/snackbar.
      }
    } catch (err) { 
      // TODO: Replace with app toast/snackbar.
    } finally {
      acceptingRef.current = false;
    }
  }, [isOnline, handleTabSwitch, fetchAvailableOrders]);

  const handlePickedUp = useCallback(() => { 
    if (deliveryStatus !== 'pickup') return;
    setDeliveryStatus('dropoff'); 
  }, [deliveryStatus]);
  
  const handleDelivered = useCallback(async (otp) => {
    if (!activeOrder?._id) return { success: false, message: "No active order found." };

    if (!otp || otp.length < 4) {
      return { success: false, message: "Please enter a valid 4-digit OTP." };
    }

    try {
      const res = await authFetch(`${API_BASE}/api/rider/orders/${activeOrder._id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp })
      });
      
      if (res && res.ok) {
        const data = await res.json();
        setActiveOrder(null);
        setDeliveryStatus('pickup');
        handleTabSwitch('home'); 
        fetchProfile(); 
        fetchAvailableOrders();
        return { success: true, message: data.message };
      } else if (res) {
        const data = await res.json();
        return { success: false, message: data.message || data.error };
      }
    } catch (err) {
      return { success: false, message: "Network error while verifying OTP." };
    }
    return { success: false, message: "Unknown error occurred." };
  }, [activeOrder, handleTabSwitch, fetchProfile, fetchAvailableOrders]);

  const executeLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    navigate('/login', { replace: true });
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  return (
    <>
      {newOrderToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[200] w-[90%] md:w-auto min-w-[300px] bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 transition-all animate-fade-in-up">
          <span className="text-2xl animate-bounce">🛵</span>
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-wide text-orange-500">New Request Nearby!</p>
            <p className="text-xs font-medium opacity-80 mt-0.5">Check Home Tab. Earn NPR {(newOrderToast.totalAmount / 100).toFixed(2) || "---"}</p>
          </div>
          <button 
            onClick={() => setNewOrderToast(null)} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 dark:bg-gray-100 text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-black transition"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex min-h-dvh bg-gray-50 dark:bg-[#0a0a0a] text-gray-800 dark:text-gray-300 font-sans overflow-hidden">
        
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 min-h-dvh">
          <div className="p-6">
            <button onClick={refreshDashboard} className="text-xl font-black text-orange-500 italic tracking-tight text-left hover:opacity-80">
              FOOD SAMUNDAR
            </button>
            <p className="text-xs font-medium text-gray-500 mt-1">{riderName}</p>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 mt-4">
            <button onClick={() => handleTabSwitch('home')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'home' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
              <span className="text-lg">🏠</span> Home
            </button>
            <button onClick={() => handleTabSwitch('orders')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
              <div className="flex items-center gap-3"><span className="text-lg">📦</span> Orders</div>
              {activeOrder && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>}
            </button>
            <button onClick={() => handleTabSwitch('wallet')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'wallet' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
              <span className="text-lg">💰</span> Wallet
            </button>
            <button onClick={() => handleTabSwitch('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'profile' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
              <span className="text-lg">👤</span> Profile
            </button>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-h-dvh relative">
          <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 md:px-8 py-3 md:py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
            <div className="md:hidden">
              <button onClick={refreshDashboard} className="text-lg font-black text-orange-500 italic tracking-tight leading-none text-left">
                FOOD SAMUNDAR
              </button>
              <p className="text-[10px] font-bold text-gray-500 mt-1">{riderName}</p>
            </div>

            <div className="hidden md:block">
               {isOnline && (
                 <div className="flex items-center gap-2 text-sm font-medium">
                   <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                   Live Shift: <span className="font-mono text-green-600 dark:text-green-400 font-bold">{shiftDuration}</span>
                 </div>
               )}
            </div>
            
            <div className="flex items-center gap-3 md:gap-5">
              <div className="md:hidden text-right mr-2">
                 {isOnline && <p className="text-[10px] font-mono text-green-500 font-bold">{shiftDuration}</p>}
              </div>

              <div 
                className={`flex items-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 rounded-full shadow-inner cursor-pointer transition-all ${isToggling ? 'opacity-50 pointer-events-none' : ''}`} 
                onClick={handleToggleOnline}
              >
                <span className={`text-[10px] font-black pl-2 pr-1 ${!isOnline ? 'text-red-500' : 'text-gray-400 dark:text-gray-600'}`}>OFF</span>
                <div className={`w-10 md:w-12 h-5 md:h-6 rounded-full relative transition-all duration-300 ${isOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-700'}`}>
                  <div className={`w-4 h-4 md:w-5 md:h-5 bg-white rounded-full absolute top-0.5 transition-all duration-300 shadow-sm ${isOnline ? 'left-5 md:left-6' : 'left-0.5'}`}></div>
                </div>
                <span className={`text-[10px] font-black pr-2 pl-1 ${isOnline ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`}>ON</span>
              </div>

              <button onClick={handleLogoutClick} className="text-red-500 bg-red-50 dark:bg-red-500/10 p-2 md:px-4 md:py-2 rounded-lg md:rounded-xl hover:bg-red-100 transition-colors">
                  <span className="md:hidden text-lg">🚪</span> 
                  <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Logout</span>
              </button>
            </div>
            </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 custom-scrollbar">
            <div className="w-full">
              {activeTab === 'home' && (
                  <RiderHomeTab 
                      isOnline={isOnline} 
                      isLoading={isLoading} 
                      orders={orders} 
                      activeOrder={activeOrder} 
                      deliveryStatus={deliveryStatus} 
                      currentTime={currentTime} 
                      handleAcceptOrder={handleAcceptOrder} 
                      handlePickedUp={handlePickedUp} 
                      handleDelivered={handleDelivered} 
                  />
              )}
              {activeTab === 'orders' && (
                  <RiderOrdersTab 
                      activeOrder={activeOrder} 
                      deliveryStatus={deliveryStatus} 
                      handlePickedUp={handlePickedUp} 
                      handleDelivered={handleDelivered} 
                  />
              )}
              {activeTab === 'wallet' && <RiderWalletTab walletBalance={walletBalance} apiBase={API_BASE} authFetch={authFetch} />}
              {activeTab === 'profile' && <RiderProfileTab riderName={riderName} riderDetails={riderDetails} />}
            </div>
          </div>

          <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex justify-around p-2 z-50 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
            <button onClick={() => handleTabSwitch('home')} className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${activeTab === 'home' ? 'text-orange-500' : 'text-gray-400'}`}>
              <span className="text-xl mb-1">🏠</span>
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button onClick={() => handleTabSwitch('orders')} className={`flex flex-col items-center p-2 min-w-[64px] relative transition-colors ${activeTab === 'orders' ? 'text-orange-500' : 'text-gray-400'}`}>
              <span className="text-xl mb-1">📦</span>
              <span className="text-[10px] font-bold">Orders</span>
              {activeOrder && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>}
            </button>
            <button onClick={() => handleTabSwitch('wallet')} className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${activeTab === 'wallet' ? 'text-orange-500' : 'text-gray-400'}`}>
              <span className="text-xl mb-1">💰</span>
              <span className="text-[10px] font-bold">Wallet</span>
            </button>
            <button onClick={() => handleTabSwitch('profile')} className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${activeTab === 'profile' ? 'text-orange-500' : 'text-gray-400'}`}>
              <span className="text-xl mb-1">👤</span>
              <span className="text-[10px] font-bold">Profile</span>
            </button>
          </nav>
        </main>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-800 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              🚪
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Leaving so soon?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 font-medium">Are you sure you want to log out of your rider account?</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowLogoutConfirm(false);

                }} 
                className="app-close-btn flex-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold py-3.5 rounded-xl hover:bg-red-100 transition border border-red-200 dark:border-red-500/20"
              >
                ❌ Cancel
              </button>
              <button 
                onClick={executeLogout} 
                className="flex-1 bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/30 transition"
              >
                ✅ Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RiderDashboard;
