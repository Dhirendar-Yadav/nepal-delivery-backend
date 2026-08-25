import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import useBrowserBackNavigation from './hooks/useBrowserBackNavigation';
import useImageCapture from './hooks/useImageCapture';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import { io } from 'socket.io-client';
import Cropper from 'react-easy-crop';

function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const restaurantName = localStorage.getItem('userName') || "My Restaurant";
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";

  const [orders, setOrders] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [restaurant, setRestaurant] = useState(null);
const [updatingStoreStatus, setUpdatingStoreStatus] = useState(false);
const [userProfile, setUserProfile] = useState(null);
const [profileImageRefreshKey, setProfileImageRefreshKey] = useState(() => Date.now());
const [isProfilePhotoMenuOpen, setIsProfilePhotoMenuOpen] = useState(false);
const [isProfilePhotoEditorOpen, setIsProfilePhotoEditorOpen] = useState(false);
const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
const [activeDocumentPreview, setActiveDocumentPreview] = useState(null);
const [rejectingOrderId, setRejectingOrderId] = useState(null);
const [rejectReason, setRejectReason] = useState('');
const [rejectReasonType, setRejectReasonType] = useState('');
const [activeTab, setActiveTab] = useState(
  () => sessionStorage.getItem('sellerDashboardActiveTab') || 'orders'
);
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // 🚀 Fix: Use useRef for Socket and Audio to prevent memory leaks and infinite loops
  const socketRef = useRef(null);
  const newOrderSoundRef = useRef(null);
  const riderAssignedSoundRef = useRef(null);
  const hasJoinedRoom = useRef(false); // To prevent multiple room joins
  const profileCropLastTapRef = useRef(0);

  const {
    videoRef: imageCaptureVideoRef,
    streamRef: imageCaptureStreamRef,
    facingMode: imageCaptureFacingMode,
    cameraOpen: imageCaptureCameraOpen,
    cameraError: imageCaptureCameraError,
    capturedImage: imageCaptureCapturedImage,
    crop: imageCaptureCrop,
    zoom: imageCaptureZoom,
    croppedAreaPixels: imageCaptureCroppedAreaPixels,
    setCapturedImage: setImageCaptureCapturedImage,
    setCrop: setImageCaptureCrop,
    setZoom: setImageCaptureZoom,
    setCroppedAreaPixels: setImageCaptureCroppedAreaPixels,
    openCamera: openImageCaptureCamera,
    switchCamera: switchImageCaptureCamera,
    capturePhoto: captureImageCapturePhoto,
    selectImage: selectImageCaptureImage,
    createCroppedBlob: createImageCaptureCroppedBlob,
    stopCamera: stopImageCaptureCamera,
    resetImageState: resetImageCaptureImageState,
    reset: resetImageCapture
  } = useImageCapture();
    const isProfileCameraOpen = imageCaptureCameraOpen;
  const [profileCameraError, setProfileCameraError] = useState('');
  const effectiveProfileCameraError =
    profileCameraError || imageCaptureCameraError;
  const profileCapturedImage = imageCaptureCapturedImage;
  const setProfileCapturedImage = setImageCaptureCapturedImage;
  const profileCrop = imageCaptureCrop;
  const setProfileCrop = setImageCaptureCrop;
  const profileZoom = imageCaptureZoom;
  const setProfileZoom = setImageCaptureZoom;
  const profileCroppedAreaPixels = imageCaptureCroppedAreaPixels;
  const setProfileCroppedAreaPixels = setImageCaptureCroppedAreaPixels;

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

  const fetchMyMenu = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/seller/menu`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setMyItems(data);
      } else {
        console.error("Menu 400 Error:", data.error || "Restaurant Not Linked");
      }
    } catch (error) {
      console.error("Menu fetch error:", error);
    }
  }, [API_BASE]);

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

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUserProfile(data.user);
      } else {
        console.error(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [API_BASE]);

  useEffect(() => {
    const role = localStorage.getItem('userRole');

if (authLoading) return;

if (role !== 'Seller' || !isAuthenticated) {
  navigate('/login');
  return;
}

    // Initialize Audio Objects ONCE
    newOrderSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    riderAssignedSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    // Ask for Browser Notification Permission
    if ("Notification" in window) {
      Notification.requestPermission();
    }

socketRef.current = io(API_BASE, {
  withCredentials: true,
  transports: ["websocket"]
});

    setTimeout(() => {
      fetchOrders();
    }, 0);

    setTimeout(() => {
      fetchMyMenu();
    }, 0);

    setTimeout(() => {
      fetchRestaurant();
    }, 0);

    setTimeout(() => {
      fetchUserProfile();
    }, 0);

    socketRef.current.on('newLiveOrder', (newOrder) => {
      console.log("🔥 New Order Received:", newOrder);
      // 🚀 Fix: Functional State Update
      setOrders((prevOrders) => [newOrder, ...prevOrders]);

      // 🚀 Fix: Removed blocking alert(), using native Notification
      if (Notification.permission === "granted") {
        new Notification(`🛎️ NEW ORDER!`, { body: `Customer: ${newOrder.customerId?.name || 'Guest'}` });
      }

      try {
        newOrderSoundRef.current.play();
      } catch {
        console.log("Sound play blocked by browser");
      }
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
      } catch {
        console.log("Sound play blocked by browser");
      }
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
  }, [navigate, authLoading, isAuthenticated, fetchOrders, fetchMyMenu, fetchRestaurant, fetchUserProfile, API_BASE]);
  useEffect(() => {
    sessionStorage.setItem(
      'sellerDashboardActiveTab',
      activeTab
    );
  }, [activeTab]);
  // 🚀 Fix: Stable Room Joiner Logic
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

  const updateOrderStatus = async (orderId, newStatus, reason = '') => {
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
        setRejectingOrderId(null);
        setRejectReason('');
        setRejectReasonType('');
      }
    } else {
      console.error("Failed to update order status.");
    }
  } catch {
    console.error("Failed to update status.");
  }
};

  const createProfileCroppedImage = useCallback(
    (imageSrc, cropAreaPixels) =>
      createImageCaptureCroppedBlob(
        imageSrc,
        cropAreaPixels,
        'image/jpeg',
        0.92
      ),
    [createImageCaptureCroppedBlob]
  );

  const selectProfileImage = async () => {
    const result = await selectImageCaptureImage();

    if (!result) {
      setProfileCameraError(
        imageCaptureCameraError ||
          'Unable to open the selected image. Please try again.'
      );
      return;
    }

    setProfileCameraError('');
    setProfileCapturedImage(result.imageData);
    setProfileCrop({ x: 0, y: 0 });
    setProfileZoom(1);
    setProfileCroppedAreaPixels(null);
    stopImageCaptureCamera();
    setIsProfilePhotoEditorOpen(true);
    setIsProfilePhotoMenuOpen(false);

    pushBrowserHistory({
      tab: activeTab,
      profilePhoto: 'upload-editor'
    });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/seller/menu`, {
  method: 'POST',
  credentials: 'include',
  headers: {
      'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      name: itemName,
      price: Number(itemPrice),
      description: itemDescription
  })
});

      if (response.ok) {
        setItemName(''); setItemPrice(''); setItemDescription('');
        fetchMyMenu();
        // Replaced alert with Notification for better UX
        if (Notification.permission === "granted") {
            new Notification(`✅ Item Added!`, { body: `${itemName} is now live.` });
        }
      } else {
        const errorData = await response.json();
        console.error(`Failed: ${errorData.error || errorData.message || "Invalid Data"}`);
      }
    } catch {
        console.error("Network Error: Make sure backend is running.");
    }
  };
  const toggleStoreStatus = async () => {
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
};
  const handleMobileLogoutConfirm = async () => {
    await logout();
    setIsLogoutConfirmOpen(false);
    navigate('/login', { replace: true });
  };

  const resetProfilePhotoState = useCallback((openPhotoMenu = false) => {
    stopImageCaptureCamera();
    setProfileCameraError('');
    setProfileCapturedImage(null);
    setProfileCroppedAreaPixels(null);
    setProfileCrop({ x: 0, y: 0 });
    setProfileZoom(1);
    setIsProfilePhotoEditorOpen(false);
    setIsProfilePhotoMenuOpen(openPhotoMenu);
  }, []);

  const openProfilePhotoCamera = useCallback(async () => {
    setProfileCameraError('');
    setProfileCapturedImage(null);
    setProfileCroppedAreaPixels(null);
    setProfileCrop({ x: 0, y: 0 });
    setProfileZoom(1);
    setIsProfilePhotoMenuOpen(false);
    setIsProfilePhotoEditorOpen(true);

    const opened = await openImageCaptureCamera();

    if (!opened) {
      setProfileCameraError(
        'Unable to open the camera. Please try again.'
      );
    }
  }, [openImageCaptureCamera]);

  const switchProfileCamera = async () => {
    const switched = await switchImageCaptureCamera();

    if (!switched) {
      setProfileCameraError(
        imageCaptureCameraError ||
          'Unable to switch camera. Please try again.'
      );
    }
  };

  const getSellerNavigationState = useCallback(() => ({
    tab: activeTab,
    profilePhoto: null
  }), [activeTab]);

  const handleSellerNavigationBack = useCallback((previousState) => {
    if (!previousState) {
      return;
    }

    if (
      typeof previousState === 'object' &&
      previousState.tab
    ) {
      setActiveTab(previousState.tab);
    } else if (typeof previousState === 'string') {
      setActiveTab(previousState);
    }

    if (
      typeof previousState === 'object' &&
      previousState.profilePhoto
    ) {
      if (
        previousState.profilePhoto === 'menu' ||
        previousState.profilePhoto === 'upload-editor'
      ) {
        resetProfilePhotoState(true);
        return;
      }

      if (
        previousState.profilePhoto === 'camera' ||
        previousState.profilePhoto === 'camera-editor'
      ) {
        openProfilePhotoCamera();
        setIsMobileMenuOpen(false);
        return;
      }
    }

    resetProfilePhotoState(false);
    setIsMobileMenuOpen(false);
  }, [
    openProfilePhotoCamera,
    resetProfilePhotoState
  ]);

  const {
    push: pushBrowserHistory,
    replace: replaceBrowserHistory,
    reset: resetBrowserHistory,
    goBack: goBackBrowserHistory
  } = useBrowserBackNavigation({
    namespace: 'seller-dashboard',
    currentState: getSellerNavigationState(),
    onBack: handleSellerNavigationBack
  });

  const navigateToTab = (nextTab) => {
    if (nextTab === activeTab) {
      if (isMobileMenuOpen) {
        goBackBrowserHistory();
      } else {
        setIsMobileMenuOpen(false);
      }
      return;
    }

    const nextNavigationState = {
      tab: nextTab,
      profilePhoto: null
    };

    if (isMobileMenuOpen) {
      replaceBrowserHistory(nextNavigationState);
    } else {
      pushBrowserHistory(nextNavigationState);
    }

    setActiveTab(nextTab);
    setIsMobileMenuOpen(false);
  };

  const goBack = () => {
    goBackBrowserHistory();
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans pb-20">

      {/* 🧭 Top Navbar */}
            <nav className="bg-gray-800 border-b border-gray-700 py-2.5 px-3 sm:py-4 sm:px-6 lg:px-8 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">

          <div className="border-l border-gray-700 pl-3 sm:pl-6">
            <h1 className="text-base sm:text-2xl font-black text-orange-500 tracking-tight truncate max-w-[140px] sm:max-w-none">
              {restaurant?.name || restaurantName || "My Restaurant"}
            </h1>

            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
              PAN: {restaurant?.panVatNumber || "Not Provided"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`md:hidden h-3 w-3 rounded-full ${
              restaurant?.isOpen ? "bg-green-500" : "bg-red-500"
            }`}
            aria-label={restaurant?.isOpen ? "Restaurant is open" : "Restaurant is closed"}
          />

          <button
            type="button"
            onClick={() => {
              pushBrowserHistory({
                tab: activeTab,
                profilePhoto: null
              });
              setIsMobileMenuOpen(true);
            }}
            className="md:hidden flex items-center justify-center p-1 text-gray-200 transition active:scale-95"
            aria-label="Open seller menu"
          >
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 rounded-full bg-gray-200" />
              <span className="block h-0.5 w-5 rounded-full bg-gray-200" />
              <span className="block h-0.5 w-5 rounded-full bg-gray-200" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="hidden md:block bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm"
          >
            LOGOUT
          </button>
        </div>
      </nav>

            {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100]">
          <button
            type="button"
            aria-label="Close seller menu"
            onClick={() => goBackBrowserHistory()}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />

          <aside className="absolute left-1/2 top-1/2 w-[82%] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-gray-700/80 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-gray-700/80 px-5 py-5">
              <h2 className="truncate text-base font-black tracking-tight text-orange-500">
                {restaurant?.name || restaurantName || "My Restaurant"}
              </h2>

              <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                PAN: {restaurant?.panVatNumber || "Not Provided"}
              </p>
            </div>

            <div className="px-3 py-4">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => navigateToTab('orders')}
                  className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                    activeTab === 'orders'
                      ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800/80'
                  }`}
                >
                  Live Orders
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('menu')}
                  className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                    activeTab === 'menu'
                      ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800/80'
                  }`}
                >
                  Menu Management
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('account')}
                  className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                    activeTab === 'account'
                      ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800/80'
                  }`}
                >
                  Profile
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('settings')}
                  className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                    activeTab === 'settings'
                      ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800/80'
                  }`}
                >
                  Settings
                </button>
              </div>

              <div className="my-3 border-t border-gray-700/80" />

              <button
  type="button"
  onClick={() => setIsLogoutConfirmOpen(true)}
  className="w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black text-red-400 transition hover:bg-red-500/10 active:scale-[0.99]"
>
  Logout
</button>
            </div>
          </aside>
        </div>
      )}


      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-12">
                {activeTab === 'profile' && (
          <>
          </>
        )}

        {activeTab === 'account' && (
          <>
            {/* ================= SELLER PROFILE ================= */}

<section className="space-y-6">
  <div className="relative flex items-start justify-between gap-6">
    <div className="min-w-0">
      <h2 className="text-2xl font-black text-white sm:text-3xl">
        Profile
      </h2>

      <p className="mt-1 text-sm font-medium text-gray-400">
        Seller account information
      </p>
    </div>

    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setIsProfilePhotoMenuOpen(true);
          stopImageCaptureCamera();
          setIsProfilePhotoEditorOpen(false);

          pushBrowserHistory({
            tab: activeTab,
            profilePhoto: 'menu'
          });
        }}
        className="h-16 w-16 overflow-hidden rounded-full border-2 border-gray-600 bg-gray-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 sm:h-20 sm:w-20"
        aria-label="Change profile photo"
      >
        {userProfile?.profileImage ? (
          <img
            src={`${API_BASE}/api/auth/profile/photo?v=${profileImageRefreshKey}`}
            alt={userProfile?.name || "Seller"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl font-black text-gray-400">
            {userProfile?.name?.charAt(0)?.toUpperCase() || "S"}
          </span>
        )}
      </button>

      {isProfilePhotoMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close profile photo menu"
            onClick={() => setIsProfilePhotoMenuOpen(false)}
            className="fixed inset-0 z-[109] cursor-default bg-transparent"
          />

          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
            onClick={() => setIsProfilePhotoMenuOpen(false)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gray-900/90 p-3 shadow-2xl backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  openProfilePhotoCamera();

                  pushBrowserHistory({
                    tab: activeTab,
                    profilePhoto: 'camera'
                  });
                }}
                className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-4 text-left text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110 active:scale-[0.98]"
              >
                <span>Take Photo</span>
                <span className="text-white/80">›</span>
              </button>

              <button
                type="button"
                onClick={selectProfileImage}
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-4 text-left text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 active:scale-[0.98]"
              >
                <span>Upload from Device</span>
                <span className="text-white/80">›</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  </div>

  <div className="space-y-3">
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Name :
      </span>
      <span className="min-w-0 break-words text-sm font-bold text-white">
        {userProfile?.name || "—"}
      </span>
    </div>

    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Email :
      </span>
      <span className="min-w-0 break-all text-sm font-bold text-white">
        {userProfile?.email || "—"}
      </span>
    </div>

    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Seller ID :
      </span>
      <span className="min-w-0 break-all font-mono text-xs font-bold text-white">
        {userProfile?.id || "—"}
      </span>
    </div>

    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        Phone :
      </span>
      <span className="min-w-0 break-words text-sm font-bold text-white">
        {userProfile?.phone
          ? String(userProfile.phone).replace(
              /^(\d{4})\d+(\d{4})$/,
              "$1••$2"
            )
          : "—"}
      </span>
    </div>

    <div className="flex items-center gap-3 pt-1">
      <span className="w-24 shrink-0 text-sm font-black text-gray-500">
        KYC :
      </span>

      <span
        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
          userProfile?.kycStatus === "VERIFIED"
            ? "bg-emerald-500/10 text-emerald-400"
            : userProfile?.kycStatus === "REJECTED"
            ? "bg-red-500/10 text-red-400"
            : "bg-amber-500/10 text-amber-400"
        }`}
      >
        {userProfile?.kycStatus || "PENDING"}
      </span>
    </div>
  </div>

  <button
    type="button"
    onClick={() => {
      setActiveDocumentPreview(null);
      setIsDocumentsModalOpen(true);
    }}
    className="inline-flex items-center text-sm font-black text-white transition hover:text-orange-400 active:scale-[0.98]"
  >
    Documents
  </button>

  {isDocumentsModalOpen && (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-md"
      onClick={() => {
        if (activeDocumentPreview) {
          setActiveDocumentPreview(null);
        } else {
          setIsDocumentsModalOpen(false);
        }
      }}
    >
      {!activeDocumentPreview ? (
        <div
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-gray-900/75 p-5 shadow-2xl backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black text-white">
              Documents
            </h3>

            <button
              type="button"
              onClick={() => setIsDocumentsModalOpen(false)}
              className="text-xl font-black text-gray-400 transition hover:text-white"
              aria-label="Close documents"
            >
              ×
            </button>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={!restaurant?.image}
              onClick={() => {
                if (!restaurant?.image) return;

                setActiveDocumentPreview({
                  type: "restaurant",
                  title: "Restaurant Image",
                  src: `${API_BASE}/api/seller/${restaurant._id}/image`
                });
              }}
              className="flex w-full items-center justify-between border-b border-white/10 py-3 text-left text-sm font-black text-white transition hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Restaurant Image</span>
              <span className="text-gray-500">›</span>
            </button>

            <button
              type="button"
              disabled={!restaurant?.registrationDoc}
              onClick={() => {
                if (!restaurant?.registrationDoc) return;

                setActiveDocumentPreview({
                  type: "registration",
                  title: "Registration Document",
                  src: `${API_BASE}/api/kyc/documents/${encodeURIComponent(
                    restaurant.registrationDoc.split("/").pop().split("\\").pop()
                  )}`
                });
              }}
              className="flex w-full items-center justify-between py-3 text-left text-sm font-black text-white transition hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Registration Document</span>
              <span className="text-gray-500">›</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gray-950/85 p-4 shadow-2xl backdrop-blur-xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <img
            src={activeDocumentPreview.src}
            alt={activeDocumentPreview.title}
            className="max-h-[84vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  )}
</section>

            {isProfilePhotoEditorOpen && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    stopImageCaptureCamera();
                    setProfileCameraError('');
                    setProfileCapturedImage(null);
                    setProfileCroppedAreaPixels(null);
                    setProfileCrop({ x: 0, y: 0 });
                    setProfileZoom(1);
                    setIsProfilePhotoEditorOpen(false);
                    setIsProfilePhotoMenuOpen(true);
                  }
                }}
              >
                <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-gray-800 px-3 py-3 sm:px-4">
                    <h2 className="text-sm font-black text-white sm:text-base">
                      {profileCapturedImage ? 'Edit Photo' : 'Take Photo'}
                    </h2>

                    <button
                      type="button"
                      onClick={() => {
                        stopImageCaptureCamera();
                        goBackBrowserHistory();
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-gray-400 transition hover:bg-gray-800 hover:text-white"
                      aria-label="Close profile photo camera"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    {!profileCapturedImage ? (
                      <>
                        {effectiveProfileCameraError ? (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
                            <p className="text-sm font-bold text-red-300">
                              {effectiveProfileCameraError}
                            </p>

                            <p className="mt-3 text-xs leading-5 text-gray-300">
                              Allow camera permission for this site in your browser settings, then try again.
                              If permission was already denied, open the browser site settings and enable Camera.
                            </p>

                            <button
                              type="button"
                              onClick={openProfilePhotoCamera}
                              className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-600"
                            >
                              Retry Camera
                            </button>
                          </div>
                        ) : (
                          <div className="mx-2 overflow-hidden rounded-xl bg-black sm:mx-3">
                            <video
                              ref={imageCaptureVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="aspect-square w-full object-cover"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 border-t border-gray-800 px-2 pb-2 pt-3 sm:gap-3 sm:px-3 sm:pb-3">
                          <button
                            type="button"
                            onClick={switchProfileCamera}
                            disabled={Boolean(effectiveProfileCameraError)}
                            className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-black text-white transition hover:bg-gray-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm"
                            aria-label="Switch camera"
                          >
                            Switch
                          </button>

                          <button
                            type="button"
                            disabled={
                              Boolean(effectiveProfileCameraError) ||
                              !isProfileCameraOpen
                            }
                            onClick={() => {
                              const capturedImage =
                                captureImageCapturePhoto();

                              if (!capturedImage) {
                                return;
                              }

                              setProfileCapturedImage(
                                capturedImage
                              );
                              setProfileCrop({ x: 0, y: 0 });
                              setProfileZoom(1);
                              setProfileCroppedAreaPixels(null);

                              pushBrowserHistory({
                                tab: activeTab,
                                profilePhoto: 'camera-editor'
                              });
                            }}
                            className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm"
                          >
                            Capture
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div
                          className="relative h-[68vw] max-h-[420px] min-h-[260px] w-full overflow-hidden rounded-2xl bg-black sm:h-[360px]"
                          onTouchEnd={(event) => {
                            if (event.changedTouches.length !== 1) {
                              return;
                            }

                            const now = Date.now();

                            if (
                              now - profileCropLastTapRef.current < 300
                            ) {
                              setProfileZoom((currentZoom) =>
                                currentZoom >= 2 ? 1 : 2
                              );
                              profileCropLastTapRef.current = 0;
                              return;
                            }

                            profileCropLastTapRef.current = now;
                          }}
                        >
                          <Cropper
                            image={profileCapturedImage}
                            crop={profileCrop}
                            zoom={profileZoom}
                            aspect={1}
                            cropShape="rect"
                            showGrid
                            objectFit="contain"
                            zoomWithScroll={false}
                            onCropChange={setProfileCrop}
                            onCropComplete={(_, croppedAreaPixels) =>
                              setProfileCroppedAreaPixels(croppedAreaPixels)
                            }
                            onZoomChange={setProfileZoom}
                            onDoubleClick={() => {
                              setProfileZoom((currentZoom) =>
                                currentZoom >= 2 ? 1 : 2
                              );
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-gray-800 px-2 pb-2 pt-3 sm:gap-3 sm:px-3 sm:pb-3">
                          <button
                            type="button"
                            onClick={() => {
                              openProfilePhotoCamera();

                              replaceBrowserHistory({
                                tab: activeTab,
                                profilePhoto: 'camera'
                              });
                            }}
                            className="w-full rounded-xl bg-gray-800 px-3 py-2 text-xs font-black text-white transition hover:bg-gray-700 active:scale-[0.98] sm:px-3 sm:py-2.5 sm:text-sm"
                          >
                            Retake
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                !profileCapturedImage ||
                                !profileCroppedAreaPixels
                              ) {
                                return;
                              }

                              try {
                                const croppedBlob =
                                  await createProfileCroppedImage(
                                    profileCapturedImage,
                                    profileCroppedAreaPixels
                                  );

                                const formData = new FormData();

                                formData.append(
                                  'profileImage',
                                  croppedBlob,
                                  'profile-photo.jpg'
                                );

                                const response = await fetch(
                                  `${API_BASE}/api/auth/profile/photo`,
                                  {
                                    method: 'POST',
                                    credentials: 'include',
                                    body: formData
                                  }
                                );

                                const responseData = await response.json();

                                if (!response.ok || !responseData.success) {
                                  throw new Error(
                                    responseData.message ||
                                      responseData.error ||
                                      'Failed to save profile photo.'
                                  );
                                }

                                if (responseData.user) {
                                  setUserProfile(responseData.user);
                                  setProfileImageRefreshKey(Date.now());
                                }

                                setProfileCapturedImage(null);
                                setProfileCroppedAreaPixels(null);
                                setProfileCrop({ x: 0, y: 0 });
                                setProfileZoom(1);
                                stopImageCaptureCamera();
                                setIsProfilePhotoEditorOpen(false);
                                setIsProfilePhotoMenuOpen(false);

                                resetBrowserHistory({
                                  tab: activeTab,
                                  profilePhoto: null
                                });
                              } catch (error) {
                                console.error(
                                  'Profile photo save failed:',
                                  error
                                );

                                setProfileCameraError(
                                  error.message ||
                                    'Failed to save profile photo. Please try again.'
                                );
                              }
                            }}
                            className="w-full rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600 active:scale-[0.98] sm:px-3 sm:py-2.5 sm:text-sm"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <section className="space-y-8">
              <div>
                <h2 className="text-2xl font-black text-white sm:text-3xl">
                  Settings
                </h2>

                <div className="mt-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">
                    Restaurant
                  </h3>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-gray-300 sm:text-base">
                      Restaurant is currently {restaurant?.isOpen ? 'open' : 'closed'}
                    </p>

                    <button
                      type="button"
                      aria-label={
                        restaurant?.isOpen
                          ? "Tap to close restaurant"
                          : "Tap to open restaurant"
                      }
                      disabled={updatingStoreStatus}
                      onClick={toggleStoreStatus}
                      className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black tracking-wide transition-all duration-200 active:scale-95 ${
                        restaurant?.isOpen
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-red-500 text-white hover:bg-red-600"
                      } ${
                        updatingStoreStatus
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      {updatingStoreStatus
                        ? "Updating"
                        : restaurant?.isOpen
                        ? "Tap to close"
                        : "Tap to open"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'orders' && (
          <>
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
                    order.status === 'Pending' ? 'bg-red-500 animate-pulse' : order.status === 'Preparing' ? 'bg-orange-500' : 'bg-green-500'
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
    <div className="flex items-center gap-3">
        <button
            type="button"
            onClick={() => {
                setRejectingOrderId(order._id);
                setRejectReason("");
                setRejectReasonType("");
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all"
        >
            Reject Order
        </button>

        <button
            type="button"
            onClick={() => updateOrderStatus(order._id, 'Accepted')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all"
        >
            Accept Order
        </button>
    </div>
)}

                        {order.status === 'Accepted' && !order.assignedRiderId && (
                        <div className="text-right">
                            <p className="text-sm text-gray-400 font-bold animate-pulse mb-2">📡 Finding Nearest Rider...</p>
                            <button disabled className="bg-gray-600 text-gray-400 px-6 py-3 rounded-xl font-black shadow-lg cursor-not-allowed">
                            Start Cooking 👨‍🍳
                            </button>
                        </div>
                        )}

                        {order.status === 'Accepted' && order.assignedRiderId && (
                        <button onClick={() => updateOrderStatus(order._id, 'Preparing')} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all animate-bounce">
                            Start Cooking 👨‍🍳
                        </button>
                        )}

                        {order.status === 'Preparing' && (
                        <button onClick={() => updateOrderStatus(order._id, 'Ready for Pickup')} className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all">
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
          </>
        )}

        {rejectingOrderId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
              <div className="mb-6">
                <h3 className="text-2xl font-black text-white">
                  Reject Order
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Select the reason for rejecting this order.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  "Food unavailable",
                  "Item out of stock",
                  "Restaurant too busy",
                  "Restaurant temporarily unavailable"
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setRejectReasonType(reason);
                      setRejectReason(reason);
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-left font-bold transition ${
                      rejectReasonType === reason
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-gray-700 bg-gray-900 text-gray-300 hover:border-red-500/50"
                    }`}
                  >
                    {reason}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setRejectReasonType("Other");
                    setRejectReason("");
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left font-bold transition ${
                    rejectReasonType === "Other"
                      ? "border-red-500 bg-red-500/10 text-red-400"
                      : "border-gray-700 bg-gray-900 text-gray-300 hover:border-red-500/50"
                  }`}
                >
                  Other
                </button>
              </div>

              {rejectReasonType === "Other" && (
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  maxLength={300}
                  className="mt-4 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-red-500"
                  placeholder="Enter the reason for rejecting this order..."
                />
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingOrderId(null);
                    setRejectReason("");
                    setRejectReasonType("");
                  }}
                  className="rounded-xl bg-gray-700 px-5 py-3 font-black text-white transition hover:bg-gray-600"
                >
                  Close
                </button>

                <button
                  type="button"
                  disabled={!rejectReason.trim()}
                  onClick={() => updateOrderStatus(rejectingOrderId, 'Cancelled', rejectReason)}
                  className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <>
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
          </>
        )}
      </div>

      <LogoutConfirmModal
        open={isLogoutConfirmOpen}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleMobileLogoutConfirm}
      />
    </div>
  );
}

export default Dashboard;
