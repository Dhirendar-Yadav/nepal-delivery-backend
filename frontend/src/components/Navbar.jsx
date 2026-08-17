import DesktopNavbar from "./nav/DesktopNavbar";
import MobileNavbar from "./nav/MobileNavbar";
import { useLocation } from "../hooks/useLocation";

function Navbar({

    onShowCEOProfile,

    searchQuery,

    setSearchQuery,

}) {

    // Temporary placeholders
    const user = null;

    const notificationCount = 0;

    const { location, permission } = useLocation();

const currentLocation =
    permission === "granted" && location
        ? "Current Location"
        : "Location Off";

    return (
        <nav className="bg-white shadow-sm px-3 py-2 md:px-5 md:py-3 sticky top-0 z-[60] border-b border-gray-100">
            <DesktopNavbar
    user={user}
    currentLocation={currentLocation}
    notificationCount={notificationCount}
    onShowCEOProfile={onShowCEOProfile}
/>
            <MobileNavbar
    user={user}
    currentLocation={currentLocation}
    notificationCount={notificationCount}
    onShowCEOProfile={onShowCEOProfile}
    searchQuery={searchQuery}
    setSearchQuery={setSearchQuery}
/>
        </nav>
    );
}

export default Navbar;
