import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { CartProvider } from "./cart/CartContext";

import Home from "./Home";
import Menu from "./Menu";
import Checkout from "./Checkout";

import Login from "./Login";
import Signup from "./Signup";
import SellerSignup from "./SellerSignup";
import RiderSignup from "./RiderSignup";

import Dashboard from "./Dashboard";
import RiderDashboard from "./pages/rider/RiderDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CustomerLayout from "./layouts/CustomerLayout";

import SearchPage from "./pages/customer/SearchPage";
import CustomerOrders from "./pages/customer/CustomerOrders";

function App() {
    return (
        <CartProvider>
            <Router>

                <Routes>

                    {/* ---------------- CUSTOMER LAYOUT ---------------- */}

                   <Route element={<CustomerLayout />}>

    <Route
        path="/"
        element={<Home />}
    />

    <Route
        path="/search"
        element={<SearchPage />}
    />

    <Route
        path="/orders"
        element={<CustomerOrders />}
    />

</Route>

                    {/* ---------------- MENU ---------------- */}

                    <Route
                        path="/menu/:id"
                        element={<Menu />}
                    />

                    <Route
                        path="/checkout"
                        element={<Checkout />}
                    />

                    {/* ---------------- AUTH ---------------- */}

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/signup"
                        element={<Signup />}
                    />

                    <Route
                        path="/seller/signup"
                        element={<SellerSignup />}
                    />

                    <Route
                        path="/rider/signup"
                        element={<RiderSignup />}
                    />

                    {/* ---------------- DASHBOARDS ---------------- */}

                    <Route
                        path="/dashboard"
                        element={<Dashboard />}
                    />

                    <Route
                        path="/rider/dashboard"
                        element={<RiderDashboard />}
                    />

                    <Route
                        path="/admin-dhiru-portal-99"
                        element={<AdminDashboard />}
                    />

                    {/* ---------------- FALLBACK ---------------- */}

                    <Route
                        path="*"
                        element={<Navigate to="/" replace />}
                    />

                </Routes>

            </Router>
        </CartProvider>
    );
}

export default App;