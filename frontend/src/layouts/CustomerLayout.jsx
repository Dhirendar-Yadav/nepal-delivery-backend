import { Outlet } from "react-router-dom";
import { useState } from "react";

import Navbar from "../components/Navbar";
import BottomNavigation from "../components/BottomNavigation";
import CEOProfile from "../components/CEOProfile";

function CustomerLayout() {

    const [searchQuery, setSearchQuery] = useState("");

    const [showCEOProfile, setShowCEOProfile] = useState(false);

    if (showCEOProfile) {
        return (
            <CEOProfile
                onClose={() => setShowCEOProfile(false)}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">

            <Navbar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onShowCEOProfile={() =>
                    setShowCEOProfile(true)
                }
            />

            <main className="pb-20">
                <Outlet
                    context={{
                        searchQuery,
                        setSearchQuery,
                    }}
                />
            </main>

            <BottomNavigation />

        </div>
    );
}

export default CustomerLayout;