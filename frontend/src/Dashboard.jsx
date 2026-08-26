import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import useBrowserBackNavigation from './hooks/useBrowserBackNavigation';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import UniversalImageEditor from './components/UniversalImageEditor';
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
const [itemFoodCategory, setItemFoodCategory] = useState('Veg');
const [itemTags, setItemTags] = useState('');
const [editingMenuItem, setEditingMenuItem] = useState(null);
const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
const [isMenuImageOverlayOpen, setIsMenuImageOverlayOpen] = useState(false);
const [menuImageBlob, setMenuImageBlob] = useState(null);

const [restaurant, setRestaurant] = useState(null);
const [updatingStoreStatus, setUpdatingStoreStatus] = useState(false);
const [userProfile, setUserProfile] = useState(null);
const [profileImageRefreshKey, setProfileImageRefreshKey] = useState(() => Date.now());
const [isProfilePhotoMenuOpen, setIsProfilePhotoMenuOpen] = useState(false);
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

  const handleAddItem = async (e) => {
    e.preventDefault();

    const normalizedName = itemName.trim();
    const normalizedDescription = itemDescription.trim();
    const numericPrice = Number(itemPrice);
    const normalizedTags = [
      ...new Set(
        itemTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ];

    const isEditing = Boolean(editingMenuItem?._id);
    const hasMenuImage = Boolean(menuImageBlob);

    if (!normalizedName) {
      console.error('Menu item name is required.');
      return false;
    }

    if (
      !Number.isInteger(numericPrice) ||
      numericPrice < 100
    ) {
      console.error(
        'Menu item price must be a whole number of at least NPR 100.'
      );
      return false;
    }

    if (
      itemFoodCategory !== 'Veg' &&
      itemFoodCategory !== 'Non-Veg'
    ) {
      console.error('Menu item food category must be Veg or Non-Veg.');
      return false;
    }

    if (normalizedTags.length > 10) {
      console.error('A menu item can have a maximum of 10 tags.');
      return false;
    }

    if (normalizedTags.some((tag) => tag.length > 50)) {
      console.error('Each menu tag must be 50 characters or fewer.');
      return false;
    }
    if (
      isEditing &&
      (!Number.isInteger(editingMenuItem.__v) ||
        editingMenuItem.__v < 0)
    ) {
      console.error('Menu item version is missing or invalid.');
      return false;
    }

    const endpoint = isEditing
      ? `${API_BASE}/api/seller/menu/${encodeURIComponent(
          editingMenuItem._id
        )}`
      : `${API_BASE}/api/seller/menu`;

    const method = isEditing ? 'PATCH' : 'POST';

    const payload = {
      name: normalizedName,
      price: numericPrice,
      description: normalizedDescription,
      foodCategory: itemFoodCategory,
      tags: normalizedTags
    };

    if (isEditing) {
      payload.__v = editingMenuItem.__v;
    }

    try {
      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          console.error(
            'Menu item was changed by another request. Refreshing menu.'
          );
          await fetchMyMenu();
          return false;
        }

        console.error(
          `Failed: ${data.error || data.message || 'Invalid Data'}`
        );
        return false;
      }

      let savedItem = data.item;

      if (
        hasMenuImage &&
        savedItem?._id &&
        Number.isInteger(savedItem.__v)
      ) {
        const imageFormData = new FormData();

        imageFormData.append(
          'menuImage',
          menuImageBlob,
          'menu-image.jpg'
        );

        imageFormData.append(
          '__v',
          String(savedItem.__v)
        );

        const imageResponse = await fetch(
          `${API_BASE}/api/seller/menu/${encodeURIComponent(
            savedItem._id
          )}/image`,
          {
            method: 'POST',
            credentials: 'include',
            body: imageFormData
          }
        );

        const imageData = await imageResponse.json();

        if (!imageResponse.ok) {
          if (imageResponse.status === 409) {
            console.error(
              'Menu item changed before image upload. Refreshing menu.'
            );
          } else {
            console.error(
              `Menu image upload failed: ${
                imageData.error ||
                imageData.message ||
                'Unable to upload image.'
              }`
            );
          }

          await fetchMyMenu();
          return false;
        }

        savedItem = imageData.item || savedItem;
      }

      setItemName('');
      setItemPrice('');
      setItemDescription('');
      setItemFoodCategory('Veg');
      setItemTags('');
      setEditingMenuItem(null);
      setMenuImageBlob(null);
      setIsMenuImageOverlayOpen(false);

      await fetchMyMenu();

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(
          isEditing ? 'Item Updated!' : 'Item Added!',
          {
            body: `${normalizedName} ${
              isEditing ? 'was updated.' : 'is now live.'
            }`
          }
        );
      }

      return true;
    } catch (error) {
      console.error(
        `Network Error while ${
          isEditing ? 'updating' : 'adding'
        } menu item:`,
        error
      );

      return false;
    }
  };
  const handleDeleteMenuItem = async (item) => {
    if (!item?._id) {
      console.error('Menu item ID is missing.');
      return;
    }

    if (!Number.isInteger(item.__v) || item.__v < 0) {
      console.error('Menu item version is missing or invalid.');
      return;
    }

    const confirmed = window.confirm(
      `Delete "${item.name}" from your menu?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/seller/menu/${encodeURIComponent(item._id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            __v: item.__v
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        await fetchMyMenu();
        return;
      }

      if (response.status === 409) {
        console.error(
          'Menu item was changed by another request. Refreshing menu.'
        );
        await fetchMyMenu();
        return;
      }

      console.error(
        `Menu delete failed: ${data.error || data.message || 'Invalid request'}`
      );
    } catch (error) {
      console.error('Network Error while deleting menu item:', error);
    }
  };

  const handleEditMenuItem = (item) => {
    if (!item?._id) {
      console.error('Menu item ID is missing.');
      return;
    }

    if (!Number.isInteger(item.__v) || item.__v < 0) {
      console.error('Menu item version is missing or invalid.');
      return;
    }

    setEditingMenuItem(item);
    setItemName(item.name || '');
    setItemPrice(
      item.price !== undefined && item.price !== null
        ? String(item.price)
        : ''
    );
    setItemDescription(item.description || '');
    setItemFoodCategory(
      item.foodCategory === 'Non-Veg'
        ? 'Non-Veg'
        : 'Veg'
    );
    setItemTags(
      Array.isArray(item.tags)
        ? item.tags.join(', ')
        : ''
    );
    setIsMenuSheetOpen(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
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

//Nothing

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
      setIsProfilePhotoMenuOpen(false);
      setIsMobileMenuOpen(false);
      return;
    }

    setIsProfilePhotoMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, []);

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

      <UniversalImageEditor
        open={isProfilePhotoMenuOpen}
        ariaLabel="Profile photo"
        onClose={() => {
          setIsProfilePhotoMenuOpen(false);

          resetBrowserHistory({
            tab: activeTab,
            profilePhoto: null
          });
        }}
        onSave={async ({ blob }) => {
          const formData = new FormData();

          formData.append(
            'profileImage',
            blob,
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
        }}
      />
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
            {/* Profile Photo UI is now handled by UniversalImageEditor. */}
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
            {/* ================= SECTION 2: MENU MANAGEMENT ================= */}
            <section>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="min-w-0 text-xl font-black text-white sm:text-2xl">
                  Menu Management
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setEditingMenuItem(null);
                    setItemName('');
                    setItemPrice('');
                    setItemDescription('');
                    setItemFoodCategory('Veg');
                    setItemTags('');
                    setIsMenuSheetOpen(true);
                  }}
                  className="shrink-0 px-1 py-1 text-sm font-bold text-orange-400 transition-all duration-200 hover:scale-105 hover:text-orange-300 active:scale-95 sm:text-base"
                >
                  Add Items
                </button>
              </div>

              <div className="w-full">
                <div className="grid grid-cols-[minmax(0,1fr)_80px_118px] items-center gap-x-5 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500 sm:grid-cols-[minmax(0,1fr)_110px_145px] sm:gap-x-8">
                  <span>Items</span>
                  <span>Price</span>
                  <span className="text-right">Actions</span>
                </div>

                {myItems.length === 0 ? (
                  <div className="py-8 text-sm font-medium text-gray-500">
                    No active menu items.
                  </div>
                ) : (
                  <div className="w-full">
                    {myItems.map((item) => (
                      <div
                        key={item._id}
                        className="grid grid-cols-[minmax(0,1fr)_80px_118px] items-center gap-x-5 py-3 sm:grid-cols-[minmax(0,1fr)_110px_145px] sm:gap-x-8"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white sm:text-base">
                            {item.name}
                          </p>
                        </div>

                        <div className="whitespace-nowrap text-sm font-semibold text-gray-200 sm:text-base">
                          NPR {item.price}
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-5">
                          <button
                            type="button"
                            onClick={() => handleEditMenuItem(item)}
                            className="px-1 py-1 text-xs font-semibold text-gray-300 transition hover:text-white sm:px-2 sm:text-sm"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMenuItem(item)}
                            className="px-1 py-1 text-xs font-semibold text-red-400 transition hover:text-red-300 sm:px-2 sm:text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {isMenuSheetOpen &&
              createPortal(
                <div
                  className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 px-4 py-4 backdrop-blur-xl backdrop-saturate-125"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsMenuImageOverlayOpen(false);
                      setMenuImageBlob(null);
                      setEditingMenuItem(null);
                      setIsMenuSheetOpen(false);
                    }
                  }}
                >
                  <div
                    className="w-full max-h-[90vh] max-w-sm overflow-y-auto rounded-3xl bg-white/[0.07] px-4 pb-4 pt-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-md sm:px-5"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add a new item to your restaurant menu"
                  >
                    <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-white/20" />

                    <h3 className="mb-3 text-center text-base font-black text-white sm:text-lg">
  {editingMenuItem ? 'Edit menu item' : 'Add a new item to your restaurant menu'}
</h3>

                    <form
                      onSubmit={async (e) => {
                        const saved = await handleAddItem(e);

                        if (saved) {
                          setIsMenuSheetOpen(false);
                        }
                      }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                            Item Name
                          </label>

                          <input
                            type="text"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            className="w-full rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                            placeholder="Momo"
                            required
                            maxLength="150"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                            Price (NPR)
                          </label>

                          <input
                            type="number"
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                            className="w-full rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                            placeholder="150"
                            required
                            min="100"
                            step="1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                          Description
                        </label>

                        <textarea
                          value={itemDescription}
                          onChange={(e) =>
                            setItemDescription(e.target.value)
                          }
                          className="w-full resize-none rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                          rows="2"
                          placeholder="Delicious hot momos..."
                          required
                          maxLength="500"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                            Tags
                          </label>

                          <input
                            type="text"
                            value={itemTags}
                            onChange={(e) =>
                              setItemTags(e.target.value)
                            }
                            className="w-full rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                            placeholder="spicy, popular"
                            maxLength="500"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                            Food Category
                          </label>

                          <select
                            value={itemFoodCategory}
                            onChange={(e) =>
                              setItemFoodCategory(e.target.value)
                            }
                            className="w-full rounded-lg bg-gray-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-orange-400/50"
                          >
                            <option
                              value="Veg"
                              className="bg-gray-900 text-white"
                            >
                              Veg
                            </option>
                            <option
                              value="Non-Veg"
                              className="bg-gray-900 text-white"
                            >
                              Non-Veg
                            </option>
                          </select>
                        </div>
                      </div>

                                            <div className="flex items-center justify-start">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuImageOverlayOpen(true);
                          }}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-200 ring-1 ring-white/10 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.99]"
                        >
                          {menuImageBlob
  ? 'Change Image'
  : editingMenuItem
    ? 'Change Image'
    : 'Add Image'}
                        </button>

                        <UniversalImageEditor
                          open={isMenuImageOverlayOpen}
                          ariaLabel="Menu image"
                          onClose={() => {
                            setIsMenuImageOverlayOpen(false);
                          }}
                          onSave={async ({ blob }) => {
                            setMenuImageBlob(blob);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuImageOverlayOpen(false);
                            setMenuImageBlob(null);
                            setEditingMenuItem(null);
                            setIsMenuSheetOpen(false);
                          }}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.99]"
                        >
                          Cancel
                        </button>

                        <button
  type="submit"
  className="rounded-lg px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-white/[0.07] hover:text-orange-200 active:scale-[0.99]"
>
  {editingMenuItem ? 'Update Item' : 'Add Item'}
</button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}
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
