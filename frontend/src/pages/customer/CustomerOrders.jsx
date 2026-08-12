import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import OrderCard from "../../components/customer/OrderCard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";

function CustomerOrders() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeOrders, setActiveOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);

    const navigate = useNavigate();
    const { token, loading: authLoading, logout } = useAuth();

    useEffect(() => {
    if (!authLoading && token) {
        fetchOrders();
    }
}, [authLoading, token]);
    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError("");

            if (authLoading) {
    return;
}

if (!token) {
    navigate("/login", { replace: true });
    return;
}

            const response = await fetch(`${API_BASE}/api/orders`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            console.log("========== ORDERS API ==========");
            console.log("Status:", response.status);
            console.log("Response:", data);
            console.log("================================");

            if (response.status === 401) {
    logout();
    navigate("/login", { replace: true });
    return;
}

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to load orders."
                );
            }

            setActiveOrders(data.activeOrders || []);
            setHistoryOrders(data.historyOrders || []);
        } catch (err) {
            console.error("Orders Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
if (authLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <h2 className="text-xl font-bold">
                Checking Login...
            </h2>
        </div>
    );
}
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <h2 className="text-xl font-bold">
                    Loading Orders...
                </h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <h2 className="text-red-600 text-xl font-bold">
                    {error}
                </h2>

                <button
                    onClick={fetchOrders}
                    className="px-6 py-3 rounded-xl bg-orange-500 text-white font-bold"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-5">

            <h1 className="text-3xl font-bold mb-8">
                My Orders
            </h1>

            <div className="bg-white rounded-xl shadow p-5 mb-6">

                <h2 className="text-xl font-bold mb-3">
                    Active Orders ({activeOrders.length})
                </h2>

                {activeOrders.length === 0 ? (
                    <p className="text-gray-500">
                        No active orders.
                    </p>
                ) : (
                    activeOrders.map(order => (
    <OrderCard
        key={order._id}
        order={order}
    />
))
                )}

            </div>

            <div className="bg-white rounded-xl shadow p-5">

                <h2 className="text-xl font-bold mb-3">
                    Order History ({historyOrders.length})
                </h2>

                {historyOrders.length === 0 ? (
                    <p className="text-gray-500">
                        No previous orders.
                    </p>
                ) : (
                    historyOrders.map(order => (
    <OrderCard
        key={order._id}
        order={order}
    />
))
                )}

            </div>

        </div>
    );
}

export default CustomerOrders;