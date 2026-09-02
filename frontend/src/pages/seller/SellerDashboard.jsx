import { useState, useEffect, useCallback } from 'react';
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
import useSellerOrders from './hooks/useSellerOrders';
import useSellerMenu from './hooks/useSellerMenu';
import useSellerStatement from './hooks/useSellerStatement';
import useSellerStore from './hooks/useSellerStore';
import useSellerProfile from './hooks/useSellerProfile';
import Cropper from 'react-easy-crop';

function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const restaurantName = localStorage.getItem('userName') || "My Restaurant";
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";

const [orderSection, setOrderSection] = useState(null);
const [selectedOrderId, setSelectedOrderId] = useState(null);
const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);

const {
  myItems,
  itemName,
  setItemName,
  itemPrice,
  setItemPrice,
  itemDescription,
  setItemDescription,
  itemFoodCategory,
  setItemFoodCategory,
  itemTags,
  setItemTags,
  editingMenuItem,
  setEditingMenuItem,
  isMenuSheetOpen,
  setIsMenuSheetOpen,
  isMenuImageOverlayOpen,
  setIsMenuImageOverlayOpen,
  menuImageBlob,
  setMenuImageBlob,
  fetchMyMenu,
  handleAddItem,
  handleDeleteMenuItem,
  handleEditMenuItem
} = useSellerMenu({
  API_BASE
});

const {
  userProfile,
  setUserProfile,
  fetchUserProfile
} = useSellerProfile({
  API_BASE
});

const [profileImageRefreshKey, setProfileImageRefreshKey] = useState(() => Date.now());
const [isProfilePhotoMenuOpen, setIsProfilePhotoMenuOpen] = useState(false);
const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
const [activeDocumentPreview, setActiveDocumentPreview] = useState(null);
const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

const {
  statementTransactions,
  statementLoading,
  statementError,
  setStatementError,
  statementFromDate,
  setStatementFromDate,
  statementToDate,
  setStatementToDate,
  statementPage,
  setStatementPage,
  statementTotalPages,
  statementHasNextPage,
  loadSellerStatement
} = useSellerStatement({
  API_BASE
});
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

  const {
    orders,
    fetchOrders,
    updateOrderStatus
  } = useSellerOrders({
    API_BASE,
    enabled: !authLoading && isAuthenticated && localStorage.getItem('userRole') === 'Seller',
    myItems,
    onOrderCancelled: () => {
      setRejectingOrderId(null);
      setRejectReason('');
      setRejectReasonType('');
    }
  });
    const {
    restaurant,
    updatingStoreStatus,
    fetchRestaurant,
    toggleStoreStatus
  } = useSellerStore({
    API_BASE,
    fetchOrders
  });
useEffect(() => {
    const role = localStorage.getItem('userRole');

    if (authLoading) return;

    if (role !== 'Seller' || !isAuthenticated) {
      navigate('/login');
      return;
    }

    setTimeout(() => {
      fetchMyMenu();
    }, 0);

    setTimeout(() => {
      fetchRestaurant();
    }, 0);

    setTimeout(() => {
      fetchUserProfile();
    }, 0);
  }, [
    navigate,
    authLoading,
    isAuthenticated,
    fetchMyMenu,
    fetchRestaurant,
    fetchUserProfile
  ]);
  useEffect(() => {
    sessionStorage.setItem(
      'sellerDashboardActiveTab',
      activeTab
    );
  }, [activeTab]);
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