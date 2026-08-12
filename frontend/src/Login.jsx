import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Internal logic: Authenticating user via backend engine
            const res = await axios.post(`${API_BASE}/api/auth/login`, formData);
            console.log("LOGIN RESPONSE:", res.data);
console.log("USER:", res.data.user);
console.log("PHONE:", res.data.user?.phone);
            // Securely storing authentication artifacts
            login({
    token: res.data.token,
    user: res.data.user,
});

            // Normalized role string for strict system validation
            const rawRole = res.data.user?.role;
            const userRole = rawRole ? String(rawRole).toLowerCase().trim() : 'customer';

            // CEO Dashboard Redirection
            if (userRole === 'admin') {
                alert("Welcome back, CEO Dhiru! 🛡️ Accessing Master Portal...");
                navigate('/admin-dhiru-portal-99');
            } 
            // Rider Dashboard Redirection
            else if (userRole === 'rider') {
                alert(`Welcome back, Rider ${res.data.user.name}! 🏍️`);
                navigate('/rider/dashboard');
            } 
            // Partner/Seller Dashboard Redirection
            else if (userRole === 'seller') {
                alert(`Welcome back to Partner Dashboard, ${res.data.user.name}! 🏪`);
                navigate('/dashboard'); 
            } 
            // Default Customer Home
            else {
                navigate('/');
            }

        } catch (err) {
            // Nepali: Error handling notification for UI
            alert(err.response?.data?.message || "Login Failed! Details check gara.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans text-gray-800 relative overflow-y-auto">
            <div className="w-full min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-20">
                
                <div className="w-full max-w-4xl flex flex-col">
                    
                    <div className="mb-4">

    {/* Brand */}
    <div className="flex items-center gap-2 mb-4">

        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shadow-sm">
            🍽️
        </div>

        <h1 className="text-2xl font-black text-orange-600 leading-none">
            Food Samundar
        </h1>

    </div>

    {/* Welcome */}
    <div>

        <h2 className="text-xl font-extrabold text-gray-900">
            Welcome Back
        </h2>

        <p className="mt-1 text-sm text-gray-500">
            Sign in to continue.
        </p>

    </div>

</div>
                    
                    <form
    onSubmit={handleLogin}
    className="flex flex-col gap-5"
>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <label className="text-xs font-black text-orange-500 uppercase tracking-wide ml-1">Email</label>
                                <input 
                                    type="email" 
                                    placeholder="your@email.com" 
                                    className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition text-[13px] font-medium placeholder:text-xs placeholder:text-gray-400"
                                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                                    required 
                                />
                            </div>

                            <div className="flex flex-col gap-4">
                                <label className="text-xs font-black text-orange-500 uppercase tracking-wide ml-1">Password</label>
                                <input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    className="w-full h-11 px-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition text-[13px] font-medium placeholder:text-xs placeholder:text-gray-400"
                                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                                    required 
                                />
                            </div>
                        </div>
                        
                        <button 
                            disabled={isLoading}
                            className={`w-2/3 mx-auto text-white font-black py-3 rounded-xl transition-all shadow-lg uppercase tracking-wide text-sm mt-6 ${isLoading ? 'bg-orange-300 cursor-not-allowed' : 'bg-black hover:bg-orange-600 active:scale-95'}`}
                        >
                            {isLoading ? "VERIFYING..." : "Login"}
                        </button>
                    </form>

                    <div className="mt-6 text-center space-y-1.5">

    <p className="text-sm uppercase tracking-widest text-gray-400 font-black">
        New to Food Samundar?
    </p>

    <div className="flex justify-center gap-8 text-xs font-black">

        <Link
            to="/seller/signup"
            className="text-orange-600 hover:text-orange-700"
        >
            Become Seller
        </Link>

        <span className="text-gray-300">|</span>

        <Link
            to="/rider/signup"
            className="text-orange-600 hover:text-orange-700"
        >
            Become Rider
        </Link>

    </div>

    <Link
        to="/signup"
        className="inline-block text-orange-600 text-sm border-orange-500 pb-1 font-black"
    >
        Customer Registration
    </Link>

</div>
                </div>
            </div>
        </div>
    );
};

export default Login;