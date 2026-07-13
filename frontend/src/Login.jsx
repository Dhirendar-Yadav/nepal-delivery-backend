import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Internal logic: Authenticating user via backend engine
            const res = await axios.post(`${API_BASE}/api/auth/login`, formData);
            
            // Securely storing authentication artifacts
            localStorage.setItem('token', res.data.token);
            if (res.data.user?.role) localStorage.setItem('userRole', res.data.user.role);
            if (res.data.user?.name) localStorage.setItem('userName', res.data.user.name);

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
            
            <div className="w-full max-w-4xl mx-auto relative h-0">
                <button 
                    onClick={() => navigate('/')} 
                    className="absolute top-8 left-8 text-gray-400 hover:text-orange-600 font-black text-xs uppercase tracking-widest transition-all z-[100] active:scale-95"
                >
                    Back
                </button>
            </div>

            <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 lg:p-20">
                
                <div className="w-full max-w-4xl flex flex-col">
                    
                    <div className="text-center mb-16 mt-16 md:mt-0">
                        <div className="inline-block bg-orange-50 p-6 rounded-[2.5rem] mb-8 text-6xl shadow-inner">🔐</div>
                        <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-gray-900 uppercase leading-none">
                            Nepal Delivery
                        </h2>
                        <div className="flex items-center justify-center gap-3 mt-4">
                            <p className="text-gray-400 text-xs sm:text-sm font-black uppercase tracking-[0.3em]">
                                Central Login Portal
                            </p>
                            <img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg" className="w-6 h-auto" alt="Nepal" />
                        </div>
                    </div>
                    
                    <form onSubmit={handleLogin} className="flex flex-col gap-10">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Email</label>
                                <input 
                                    type="email" 
                                    placeholder="your@email.com" 
                                    className="w-full p-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:border-orange-600 outline-none font-bold text-lg shadow-inner transition-all" 
                                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                                    required 
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Password</label>
                                <input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    className="w-full p-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:border-orange-600 outline-none font-bold text-lg shadow-inner transition-all" 
                                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                                    required 
                                />
                            </div>
                        </div>
                        
                        <button 
                            disabled={isLoading}
                            className={`w-full text-white font-black py-7 rounded-[2.5rem] transition-all shadow-[0_25px_60px_rgba(234,88,12,0.35)] uppercase tracking-[0.2em] text-lg mt-6 ${isLoading ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-600 hover:bg-gray-900 active:scale-95'}`}
                        >
                            {isLoading ? "VERIFYING..." : "Login to System"}
                        </button>
                    </form>

                    <div className="mt-16 mb-10 text-center flex flex-col items-center gap-3">
                        <p className="text-sm text-gray-400 font-black uppercase tracking-widest">
                            New to FOOD SAMUNDAR?
                        </p>
                        <Link to="/signup" className="text-orange-600 hover:text-gray-900 font-black text-sm sm:text-base border-b-2 border-orange-500 pb-1 px-2 transition-all">
                            Create Account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
