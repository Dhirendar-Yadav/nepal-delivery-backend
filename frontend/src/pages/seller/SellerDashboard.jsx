import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import useBrowserBackNavigation from '../../hooks/useBrowserBackNavigation';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import UniversalImageEditor from '../../components/UniversalImageEditor';
import SellerOrders from './components/SellerOrders';
import SellerMenu from './components/SellerMenu';
import SellerProfile from './components/SellerProfile';
import SellerAccount from './components/SellerAccount';
import SellerSettings from './components/SellerSettings';
import { io } from 'socket.io-client';
import Cropper from 'react-easy-crop';

function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const restaurantName = localStorage.getItem('userName') || "My Restaurant";
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";

const [orders, setOrders] = useState([]);
const [myItems, setMyItems] = useState([]);
const [orderSection, setOrderSection] = useState(null);
const [selectedOrderId, setSelectedOrderId] = useState(null);
const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);

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
const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
const [statementTransactions, setStatementTransactions] = useState([]);
const [statementLoading, setStatementLoading] = useState(false);
const [statementError, setStatementError] = useState('');
const [statementFromDate, setStatementFromDate] = useState('');
const [statementToDate, setStatementToDate] = useState('');
const [statementPage, setStatementPage] = useState(1);
const [statementTotalPages, setStatementTotalPages] = useState(1);
const [statementHasNextPage, setStatementHasNextPage] = useState(false);
const [rejectingOrderId, setRejectingOrderId] = useState(null);
const [rejectReason, setRejectReason] = useState('');
const [rejectReasonType, setRejectReasonType] = useState('');
const [activeTab, setActiveTab] = useState(
  () => sessionStorage.getItem('sellerDashboardActiveTab') || 'orders'
);
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  //Fix: Use useRef for Socket and Audio to prevent memory leaks and infinite loops
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
    sessionStorage.removeItem('sellerDashboardActiveTab');
    await logout();
    setIsLogoutConfirmOpen(false);
    navigate('/login', { replace: true });
  };

//Nothing

  const getSellerNavigationState = useCallback(() => ({
    tab: activeTab,
    orderSection,
    selectedOrderId,
    ordersDrawer: isOrdersDrawerOpen,
    mobileMenuOpen: isMobileMenuOpen,
    profilePhoto: null
  }), [
    activeTab,
    orderSection,
    selectedOrderId,
    isOrdersDrawerOpen,
    isMobileMenuOpen
  ]);

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

    if (typeof previousState === 'object') {
      setOrderSection(previousState.orderSection || null);
      setSelectedOrderId(previousState.selectedOrderId || null);
      setIsOrdersDrawerOpen(previousState.ordersDrawer === true);
      setIsMobileMenuOpen(previousState.mobileMenuOpen === true);
    } else {
      setOrderSection(null);
      setSelectedOrderId(null);
      setIsOrdersDrawerOpen(false);
      setIsMobileMenuOpen(false);
    }

    if (
      typeof previousState === 'object' &&
      previousState.profilePhoto
    ) {
      setIsProfilePhotoMenuOpen(false);
      return;
    }

    setIsProfilePhotoMenuOpen(false);
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
      orderSection: null,
      selectedOrderId: null,
      profilePhoto: null
    };

    if (isMobileMenuOpen) {
      replaceBrowserHistory(nextNavigationState);
    } else {
      pushBrowserHistory(nextNavigationState);
    }

    setActiveTab(nextTab);
    setOrderSection(null);
    setSelectedOrderId(null);
    setIsOrdersDrawerOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navigateToOrderSection = useCallback((nextSection) => {
  const isDesktopViewport = window.matchMedia('(min-width: 768px)').matches;

  const nextNavigationState = {
    tab: 'orders',
    orderSection: nextSection,
    selectedOrderId: null,
    ordersDrawer: isDesktopViewport,
    mobileMenuOpen: isDesktopViewport,
    profilePhoto: null
  };

  pushBrowserHistory(nextNavigationState);
  setActiveTab('orders');
  setOrderSection(nextSection);
  setSelectedOrderId(null);
  setIsOrdersDrawerOpen(isDesktopViewport);
  setIsMobileMenuOpen(isDesktopViewport);
}, [pushBrowserHistory]);

  const openOrderDetail = useCallback((orderId) => {
    if (!orderId) {
      return;
    }

    const nextNavigationState = {
      tab: 'orders',
      orderSection,
      selectedOrderId: orderId,
      profilePhoto: null
    };

    pushBrowserHistory(nextNavigationState);
    setActiveTab('orders');
    setSelectedOrderId(orderId);
    setIsMobileMenuOpen(false);
  }, [orderSection, pushBrowserHistory]);
    const orderSectionOrders = {
    new: orders.filter((order) => order.status === 'Pending'),
    preparing: orders.filter(
      (order) =>
        order.status === 'Accepted' ||
        order.status === 'Preparing'
    ),
    ready: orders.filter(
      (order) => order.status === 'Ready for Pickup'
    ),
    out: orders.filter(
      (order) => order.status === 'Out for Delivery'
    ),
    history: orders.filter(
      (order) =>
        order.status === 'Delivered' ||
        order.status === 'Cancelled'
    )
  };

  const visibleOrders = orderSection
    ? orderSectionOrders[orderSection] || []
    : orders;
  const loadSellerStatement = async (
    page = 1,
    fromDate = statementFromDate,
    toDate = statementToDate
  ) => {
    setStatementLoading(true);
    setStatementError('');

    try {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const params = new URLSearchParams({
        limit: '20',
        page: String(safePage)
      });

      if (fromDate) {
        params.set('from', fromDate);
      }

      if (toDate) {
        params.set('to', toDate);
      }

      const response = await fetch(
        `${API_BASE}/api/seller/store/statement?${params.toString()}`,
        {
          credentials: 'include'
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            data.error ||
            'Failed to load statement.'
        );
      }

      const transactions = Array.isArray(data.statement?.transactions)
        ? data.statement.transactions
        : [];

      const pagination = data.statement?.pagination || {};

      setStatementTransactions(transactions);
      setStatementPage(
        Number.isInteger(pagination.page) && pagination.page > 0
          ? pagination.page
          : safePage
      );

      setStatementTotalPages(
        Number.isInteger(pagination.totalPages) && pagination.totalPages >= 1
          ? pagination.totalPages
          : 1
      );

      setStatementHasNextPage(
        pagination.hasNextPage === true
      );
    } catch (error) {
      setStatementTransactions([]);
      setStatementPage(1);
      setStatementTotalPages(1);
      setStatementHasNextPage(false);

      setStatementError(
        error instanceof Error
          ? error.message
          : 'Failed to load statement.'
      );
    } finally {
      setStatementLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans pb-20">

      {/*  Top Navbar */}
            <nav className="bg-gray-800 border-b border-gray-700 py-2.5 px-3 sm:py-4 sm:px-6 lg:px-8 flex justify-between items-center sticky top-0 z-50">
        <div className="min-w-0 flex-1">
          <div className="min-w-0 border-l border-gray-700 pl-3 sm:pl-6">
            <h1 className="max-w-full truncate text-base font-black tracking-tight text-orange-500 sm:text-2xl">
              {restaurant?.name || restaurantName || "My Restaurant"}
            </h1>

            <p className="mt-1 max-w-full whitespace-normal break-all text-xs font-bold uppercase leading-tight tracking-widest text-gray-400">
              PAN: {restaurant?.panVatNumber || "Not Provided"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
                orderSection,
                selectedOrderId,
                ordersDrawer: isOrdersDrawerOpen,
                mobileMenuOpen: true,
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

          <div
            className="hidden md:flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gray-600 bg-gray-900 shadow-lg"
            aria-label="Seller profile photo"
          >
            {userProfile?.profileImage ? (
              <img
                src={`${API_BASE}/api/auth/profile/photo?v=${profileImageRefreshKey}`}
                alt={userProfile?.name || "Seller"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-sm font-black text-gray-400">
                {userProfile?.name?.charAt(0)?.toUpperCase() || "S"}
              </span>
            )}
          </div>
        </div>
      </nav>

            <div
  className={`fixed inset-0 z-[100] ${
    isMobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
  } md:static md:block md:pointer-events-auto`}
>
        <div
          className={`md:hidden fixed inset-0 ${
            isMobileMenuOpen ? 'block' : 'hidden'
          }`}
        >
          <button
            type="button"
            aria-label="Close seller menu"
            onClick={() => goBackBrowserHistory()}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
        </div>

        <aside
          className={`${
            isMobileMenuOpen ? 'flex' : 'hidden'
          } fixed left-1/2 top-16 bottom-4 z-[101] w-[82%] max-w-sm -translate-x-1/2 flex-col overflow-hidden rounded-3xl border border-gray-700/80 bg-gray-900/95 shadow-2xl backdrop-blur-xl md:left-0 md:top-[84px] md:bottom-0 md:flex md:w-60 md:max-w-none md:translate-x-0 md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:border-gray-800 md:bg-gray-900 md:shadow-none md:backdrop-blur-none`}
        >
            <div className="shrink-0 border-b border-gray-700/80 px-5 py-4 md:hidden">
              <h2 className="truncate text-base font-black tracking-tight text-orange-500">
                {restaurant?.name || restaurantName || "My Restaurant"}
              </h2>

              <p className="mt-1 whitespace-normal break-all text-[11px] font-bold uppercase leading-tight tracking-widest text-gray-500">
                PAN: {restaurant?.panVatNumber || "Not Provided"}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:thin]">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isOrdersDrawerOpen) {
                      setIsOrdersDrawerOpen(false);
                      return;
                    }

                    pushBrowserHistory({
                      tab: 'orders',
                      orderSection,
                      selectedOrderId: null,
                      ordersDrawer: true,
                      mobileMenuOpen: true,
                      profilePhoto: null
                    });

                    setActiveTab('orders');
                    setSelectedOrderId(null);
                    setIsOrdersDrawerOpen(true);
                  }}
                  className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                    activeTab === 'orders'
                      ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800/80'
                  }`}
                >
                  Live Orders
                </button>

                {isOrdersDrawerOpen && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-gray-700/80 pl-3">
                    <button
                      type="button"
                      onClick={() => navigateToOrderSection('new')}
                      className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                        orderSection === 'new'
                          ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800/80'
                      }`}
                    >
                      New Orders
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToOrderSection('preparing')}
                      className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                        orderSection === 'preparing'
                          ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800/80'
                      }`}
                    >
                      Rider Assigned / Preparing
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToOrderSection('ready')}
                      className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                        orderSection === 'ready'
                          ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800/80'
                      }`}
                    >
                      Ready for Pickup
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToOrderSection('out')}
                      className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                        orderSection === 'out'
                          ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800/80'
                      }`}
                    >
                      Out for Delivery
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToOrderSection('history')}
                      className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                        orderSection === 'history'
                          ? 'border-l-4 border-orange-500 bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800/80'
                      }`}
                    >
                      Order History
                    </button>
                  </div>
                )}

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
                  Account
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('profile')}
                  className={`w-full rounded-2xl px-4 py-3.5 text-left text-sm font-black transition active:scale-[0.99] ${
                    activeTab === 'profile'
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

              </div>

            <div className="shrink-0 border-t border-gray-700/80 px-3 py-3">
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


      <div className="ml-0 max-w-7xl p-6 md:ml-60 md:mr-0 md:p-10 space-y-12">
        {activeTab === 'profile' && (
          <SellerProfile
            activeTab={activeTab}
            API_BASE={API_BASE}
            userProfile={userProfile}
            profileImageRefreshKey={profileImageRefreshKey}
            isProfilePhotoMenuOpen={isProfilePhotoMenuOpen}
            setIsProfilePhotoMenuOpen={setIsProfilePhotoMenuOpen}
            pushBrowserHistory={pushBrowserHistory}
            resetBrowserHistory={resetBrowserHistory}
            setUserProfile={setUserProfile}
            setProfileImageRefreshKey={setProfileImageRefreshKey}
            isDocumentsModalOpen={isDocumentsModalOpen}
            setIsDocumentsModalOpen={setIsDocumentsModalOpen}
            activeDocumentPreview={activeDocumentPreview}
            setActiveDocumentPreview={setActiveDocumentPreview}
            restaurant={restaurant}
          />
        )}

        {activeTab === 'account' && (
          <SellerAccount
            restaurant={restaurant}
            isStatementModalOpen={isStatementModalOpen}
            setIsStatementModalOpen={setIsStatementModalOpen}
            setStatementPage={setStatementPage}
            statementPage={statementPage}
            loadSellerStatement={loadSellerStatement}
            statementFromDate={statementFromDate}
            statementToDate={statementToDate}
            setStatementFromDate={setStatementFromDate}
            setStatementToDate={setStatementToDate}
            statementLoading={statementLoading}
            statementError={statementError}
            setStatementError={setStatementError}
            statementTransactions={statementTransactions}
            statementTotalPages={statementTotalPages}
            statementHasNextPage={statementHasNextPage}
          />
        )}        {activeTab === 'settings' && (
          <SellerSettings
            restaurant={restaurant}
            updatingStoreStatus={updatingStoreStatus}
            toggleStoreStatus={toggleStoreStatus}
          />
        )}
                  {activeTab === 'orders' && (
                    <SellerOrders
                      orderSection={orderSection}
                      visibleOrders={visibleOrders}
                      openOrderDetail={openOrderDetail}
                      rejectingOrderId={rejectingOrderId}
                      setRejectReasonType={setRejectReasonType}
                      setRejectReason={setRejectReason}
                      rejectReasonType={rejectReasonType}
                      rejectReason={rejectReason}
                      setRejectingOrderId={setRejectingOrderId}
                      updateOrderStatus={updateOrderStatus}
                    />
                  )}
        {activeTab === 'menu' && (
          <SellerMenu
            myItems={myItems}
            editingMenuItem={editingMenuItem}
            setEditingMenuItem={setEditingMenuItem}
            itemName={itemName}
            setItemName={setItemName}
            itemPrice={itemPrice}
            setItemPrice={setItemPrice}
            itemDescription={itemDescription}
            setItemDescription={setItemDescription}
            itemFoodCategory={itemFoodCategory}
            setItemFoodCategory={setItemFoodCategory}
            itemTags={itemTags}
            setItemTags={setItemTags}
            isMenuSheetOpen={isMenuSheetOpen}
            setIsMenuSheetOpen={setIsMenuSheetOpen}
            isMenuImageOverlayOpen={isMenuImageOverlayOpen}
            setIsMenuImageOverlayOpen={setIsMenuImageOverlayOpen}
            menuImageBlob={menuImageBlob}
            setMenuImageBlob={setMenuImageBlob}
            handleAddItem={handleAddItem}
            handleEditMenuItem={handleEditMenuItem}
            handleDeleteMenuItem={handleDeleteMenuItem}
          />
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
