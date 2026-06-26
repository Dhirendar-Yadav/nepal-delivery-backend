import { useNavigate } from 'react-router-dom';

export default function AdminSidebar({ activeTab, setActiveTab, setSearchQuery, alertCounts = {} }) {
    const navigate = useNavigate();

    // 🛡️ NUCLEAR LOGOUT (Clears all persistent auth states)
    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        navigate('/login');
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    // 🚀 CONFIG-DRIVEN ARCHITECTURE (Ready for Roles & Badges)
    const MENU_CONFIG = [
        { 
            id: 'Overview', 
            label: 'Overview', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        },
        { 
            id: 'Riders', 
            label: 'Fleet Ops', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>,
            badge: alertCounts.riders || 0 // Ready to accept dynamic prop later
        },
        { 
            id: 'Pasals', 
            label: 'Restaurants', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
        },
        { 
            id: 'Users', 
            label: 'Customers', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        },
        { 
            id: 'Orders', 
            label: 'Live Orders', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>,
            badge: alertCounts.orders || 0
        },
        { 
            id: 'Live Tracking', 
            label: 'Radar', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
        },
        { 
            id: 'Financial Hub', 
            label: 'Fintech Hub', 
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
            requiresCEO: true // Visual indicator that this is high security
        }
    ];

    return (
        <aside className="w-full md:w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col justify-between shadow-[4px_0_24px_rgba(0,0,0,0.4)] z-20 relative">
            <div>
                {/* 🔄 Clickable Logo */}
                <div onClick={handleRefresh} className="flex items-center gap-3 mb-10 sidebar-logo cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-[0_0_15px_rgba(234,88,12,0.4)]">FS</div>
                    <div>
                        <h1 className="text-white font-black tracking-widest text-sm uppercase">Food Samundar</h1>
                    </div>
                </div>

                {/* 📋 Config-Driven Menu */}
                <nav className="space-y-2">
                    {MENU_CONFIG.map((item) => {
                        const isActive = activeTab === item.id;
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setSearchQuery(''); }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold uppercase tracking-wider transition-all duration-200 ${
                                    isActive 
                                    ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' 
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {item.icon}
                                    <span className="text-[10px]">{item.label}</span>
                                </div>

                                {/* 🛑 Dynamic Badge or Security Lock */}
                                <div className="flex items-center gap-2">
                                    {item.requiresCEO && !isActive && (
                                        <svg className="w-3 h-3 text-red-500/50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                                    )}
                                    {item.badge > 0 && (
                                        <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* 🚪 Nuclear Evacuation Button */}
            <div className="mt-10 pt-6 border-t border-gray-800">
                <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl font-bold uppercase tracking-wider transition-all border border-transparent hover:border-red-500/20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                    <span className="text-[10px]">Evacuate HQ</span>
                </button>
            </div>
        </aside>
    );
}