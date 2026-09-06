import { useEffect, useState } from "react";
import DesktopNavbar from "./nav/DesktopNavbar";
import MobileNavbar from "./nav/MobileNavbar";
import { useLocation } from "../hooks/useLocation";

function Navbar({
  onShowCEOProfile,

  searchQuery,

  setSearchQuery,

  notificationCount: externalNotificationCount = 0,

  onClearNotifications,
}) {
  const user = null;

  const [notificationDelta, setNotificationDelta] = useState(0);
  const [clearedNotificationCount, setClearedNotificationCount] = useState(
    externalNotificationCount,
  );

  const { location, permission } = useLocation();

  const liveNotificationCount = Math.max(
    0,
    externalNotificationCount - clearedNotificationCount + notificationDelta,
  );

  useEffect(() => {
    const handleCustomerNotification = (event) => {
      const eventName = event.detail?.eventName;

      if (
        eventName !== "orderDelivered" &&
        eventName !== "orderStatusUpdated" &&
        eventName !== "customerNotification"
      ) {
        return;
      }

      setNotificationDelta((count) => count + 1);
    };

    window.addEventListener(
      "customer-live-refresh",
      handleCustomerNotification,
    );

    return () => {
      window.removeEventListener(
        "customer-live-refresh",
        handleCustomerNotification,
      );
    };
  }, []);

  const currentLocation =
    permission === "granted" && location
      ? location.shortAddress || location.address || "Fetching address..."
      : "Location Off";

  const handleClearNotifications = () => {
    setClearedNotificationCount(externalNotificationCount);
    setNotificationDelta(0);

    if (onClearNotifications) {
      onClearNotifications();
    }
  };

  return (
    <nav className="bg-white shadow-sm px-3 py-2 md:px-5 md:py-3 sticky top-0 z-[60] border-b border-gray-100">
      <DesktopNavbar
        user={user}
        currentLocation={currentLocation}
        notificationCount={liveNotificationCount}
        onShowCEOProfile={onShowCEOProfile}
        onClearNotifications={handleClearNotifications}
      />
      <MobileNavbar
        user={user}
        currentLocation={currentLocation}
        notificationCount={liveNotificationCount}
        onShowCEOProfile={onShowCEOProfile}
        onClearNotifications={handleClearNotifications}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </nav>
  );
}

export default Navbar;
