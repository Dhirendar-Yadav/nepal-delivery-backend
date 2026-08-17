import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { CartProvider } from "./cart/CartContext.jsx";

const Home = lazy(() => import("./Home"));
const Menu = lazy(() => import("./Menu"));
const Checkout = lazy(() => import("./Checkout"));

const Login = lazy(() => import("./Login"));
const Signup = lazy(() => import("./Signup"));
const SellerSignup = lazy(() => import("./SellerSignup"));
const RiderSignup = lazy(() => import("./RiderSignup"));

const Dashboard = lazy(() => import("./Dashboard"));
const RiderDashboard = lazy(() => import("./pages/rider/RiderDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const CustomerLayout = lazy(() => import("./layouts/CustomerLayout"));

const SearchPage = lazy(() => import("./pages/customer/SearchPage"));
const CustomerOrders = lazy(() => import("./pages/customer/CustomerOrders"));

function App() {
    return (
                <CartProvider>
            <Router>

                <Suspense fallback={null}>
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
                </Suspense>

            </Router>
        </CartProvider>
    );
}

export default App;
