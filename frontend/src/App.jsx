import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Menu from './Menu';
import Dashboard from './Dashboard';
import Checkout from './Checkout'; 
import Login from './Login';                
import Signup from './Signup';              
import SellerSignup from './SellerSignup'; 
import { CartProvider } from './cart/CartContext';
// ✨ NAYE RIDER IMPORTS 
import RiderSignup from './RiderSignup';
import RiderDashboard from './pages/rider/RiderDashboard'; 
// 👑 ADMIN & SECRET IMPORTS
import AdminDashboard from "./pages/admin/AdminDashboard";

function App() {
  return (
    <CartProvider>
      <Router>
        <Routes>
        {/* 1. Home Page: List of all restaurants */}
        <Route path="/" element={<Home />} />

        {/* 2. Menu Page: Displays food items for a specific restaurant */}
        <Route path="/menu/:id" element={<Menu />} />

        {/* 3. Dashboard Page: Seller panel to manage menu items */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* 4. Checkout Page: Map and Delivery details selector */}
        <Route path="/checkout" element={<Checkout />} />

        {/* 5. 🚀 MASTER LOGIN: Admin, Rider, Seller, ra Customer sabaiko lagi eutai rasta */}
        <Route path="/login" element={<Login />} />

        {/* 6. Customer Signup Page: For ordering food */}
        <Route path="/signup" element={<Signup />} />

        {/* 7. Seller Signup Page: For restaurant owners */}
        <Route path="/seller/signup" element={<SellerSignup />} />

        {/* 9. ✨ Rider Routes: Delivery partners ko lagi naya setup */}
        <Route path="/rider/signup" element={<RiderSignup />} />
        <Route path="/rider/dashboard" element={<RiderDashboard />} /> 

        {/* 10. 🕵️‍♂️ SECRET ADMIN ROUTES (Dhiru Special) */}
        {/* Aba Admin le pani sidhai /login bata login garchhan, login pachi Dashboard khulcha */}
        <Route path="/admin-dhiru-portal-99" element={<AdminDashboard />} /> 
        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
