import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import Navbar from "../components/Navbar";
import BottomNavigation from "../components/BottomNavigation";
import CEOProfile from "../components/CEOProfile";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";
const CUSTOMER_LIVE_REFRESH_INTERVAL_MS = 5000;

function CustomerLayout() {

    const [searchQuery, setSearchQuery] = useState("");
    const [showCEOProfile, setShowCEOProfile] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        let socket = null;
        let refreshTimer = null;
        let mounted = true;

        const emitCustomerRefresh = (eventName, payload = null) => {
            window.dispatchEvent(
                new CustomEvent("customer-live-refresh", {
                    detail: {
                        eventName,
                        payload
                    }
                })
            );
        };

        const connectCustomerLiveChannel = () => {
            socket = io(API_BASE, {
                withCredentials: true,
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000
            });

            socket.on("connect", () => {
                if (!mounted) return;

                emitCustomerRefresh("socketConnected");
            });

            socket.on("disconnect", () => {
                if (!mounted) return;

                emitCustomerRefresh("socketDisconnected");
            });

            socket.on("orderDelivered", (payload) => {
                if (!mounted) return;

                setNotificationCount((count) => count + 1);
                emitCustomerRefresh("orderDelivered", payload);
            });

            socket.on("orderStatusUpdated", (payload) => {
                if (!mounted) return;

                setNotificationCount((count) => count + 1);
                emitCustomerRefresh("orderStatusUpdated", payload);
            });

            socket.on("customerNotification", (payload) => {
                if (!mounted) return;

                setNotificationCount((count) => count + 1);
                emitCustomerRefresh("customerNotification", payload);
            });
        };

        const refreshVisibleCustomerData = () => {
            if (!mounted) return;
            if (document.visibilityState !== "visible") return;

            emitCustomerRefresh("interval");
        };

        connectCustomerLiveChannel();

        refreshTimer = window.setInterval(
            refreshVisibleCustomerData,
            CUSTOMER_LIVE_REFRESH_INTERVAL_MS
        );

        return () => {
            mounted = false;

            if (refreshTimer) {
                window.clearInterval(refreshTimer);
            }

            if (socket) {
                socket.disconnect();
                socket = null;
            }
        };
    }, []);

    const clearNotifications = () => {
        setNotificationCount(0);
    };

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
                notificationCount={notificationCount}
                onClearNotifications={clearNotifications}
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