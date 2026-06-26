import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

// ✨ MODULAR COMPONENTS
import AdminSidebar from '../../components/admin/AdminSidebar';
import KpiCards from '../../components/admin/KpiCards';
import OrderManifestModal from '../../components/admin/OrderManifestModal';
import LiveTrackingMap from '../../components/admin/LiveTrackingMap';
import FinancialHubView from '../../components/admin/FinancialHubView';
import DataTables from '../../components/admin/DataTables';

function AdminDashboard() {
    const [ordersMap, setOrdersMap] = useState({}); 
    const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, netProfit: 0, dailyOrders: 0, dailyRevenue: 0, availableBalance: 0 });
    const [riders, setRiders] = useState([]); 
    const [sellers, setSellers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [allOrders, setAllOrders] = useState([]); 
    const [finHub, setFinHub] = useState({ pendingRiderPayouts: [], pendingSellerSettlements: [], masterWallet: {} });
    
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false); // ⏳ For Bulk Actions

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const socketRef = useRef(null);

    const safeFetch = async (url) => {
        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            return res.ok ? data : null;
        } catch (err) { return null; }
    };

    const fetchData = async () => {
        const base = 'http://localhost:5005/api/admin';
        const [s, r, sel, c, ao, f, o] = await Promise.all([
            safeFetch(`${base}/full-stats`), 
            safeFetch(`${base}/all-riders`),
            safeFetch(`${base}/restaurants`), 
            safeFetch(`${base}/all-customers`),
            safeFetch(`${base}/active-tracking-orders`), 
            safeFetch(`${base}/financial-hub`),
            safeFetch(`${base}/all-orders`)
        ]);

        if (s) setStats(s.data); 
        if (r) setRiders(r.data); 
        if (sel) setSellers(sel.data); 
        if (c) setCustomers(c.data); 
        if (f) setFinHub(f.data); 
        if (o) setAllOrders(o.data);
        
        if (ao && Array.isArray(ao.data)) {
            const normalized = {};
            ao.data.forEach(order => { normalized[order._id] = order; });
            setOrdersMap(normalized);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        socketRef.current = io('http://localhost:5005', { auth: { token } });
        socketRef.current.on('riderMoved', (data) => {
            setOrdersMap(prev => ({
                ...prev,
                [data.orderId]: { ...prev[data.orderId], riderLocation: { lat: data.latitude, lng: data.longitude }, lastUpdate: new Date().toISOString() }
            }));
        });
        const syncInterval = setInterval(fetchData, 45000); 
        fetchData();
        return () => { socketRef.current?.disconnect(); clearInterval(syncInterval); };
    }, [token]);

    // 🛡️ GOD MODE: Update Restaurant Operations (Open/Close/Delete)
    const handleRestaurantOperation = async (id, data) => {
        try {
            const res = await fetch(`http://localhost:5005/api/admin/restaurants/${id}/operate`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok && result.success) {
                alert(`Action successful!`);
                fetchData();
            } else {
                alert(`Operation Failed: ${result.error || 'Unknown error'}`);
            }
        } catch (err) { alert("Network Error: Could not connect to server"); }
    };

    // 🚦 GATEKEEPER: Approve/Suspend Restaurant (FIXED ALERTS)
    const handleRestaurantStatus = async (id, data) => {
        try {
            const res = await fetch(`http://localhost:5005/api/admin/restaurants/${id}/status`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (res.ok && result.success) {
                alert(`Restaurant status updated to ${data.status} successfully!`);
                fetchData();
            } else {
                alert(`Update Failed: ${result.error || result.message || 'Unknown error'}`);
            }
        } catch (err) { alert("Network Error: Status update failed"); }
    };

    // 💰 SETTLEMENT: Individual Payout
    const handleSettlement = async (id, amount) => {
        const ref = prompt("Enter Bank/eSewa Transaction Reference ID:");
        if (!ref) return;

        try {
            const res = await fetch(`http://localhost:5005/api/admin/restaurants/${id}/settle`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ settlementAmount: amount, transactionReference: ref })
            });
            if (res.ok) { alert("Settlement successful"); fetchData(); }
            else { const err = await res.json(); alert(err.message || "Failed"); }
        } catch (err) { alert("Settlement Error"); }
    };

    // 🚀 ELITE BULK PAYOUT
    const approveBulkPayout = async (targetType) => {
        if (!window.confirm(`CEO Command: Settle ALL ${targetType}s in this batch?`)) return;
        
        setIsProcessing(true);
        const batchId = `B-${Date.now()}`; 
        
        const processChunk = async (cursor = null) => {
            try {
                const res = await fetch(`http://localhost:5005/api/admin/payouts/bulk-approve`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetType, batchId, lastId: cursor })
                });
                const result = await res.json();
                
                if (result.success) {
                    if (result.nextCursor) {
                        await processChunk(result.nextCursor);
                    } else {
                        alert(`Batch Complete: ${result.message}`);
                        setIsProcessing(false);
                        fetchData();
                    }
                } else {
                    throw new Error(result.message);
                }
            } catch (err) {
                alert(`Bulk Error: ${err.message}`);
                setIsProcessing(false);
            }
        };

        await processChunk();
    };

    // 🛠️ THE SYSTEM AUTO-HEALER (Fixes old disabled accounts)
    const handleSyncLegacyData = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch(`http://localhost:5005/api/admin/sync-legacy-data`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`✅ Sync Complete: ${data.message}`);
            } else {
                alert(`❌ Sync Failed: ${data.error || 'Server error'}`);
            }
        } catch (err) {
            alert("Network Error: Could not connect to sync route.");
        }
        setIsProcessing(false);
    };

    const activeOrdersArray = useMemo(() => Object.values(ordersMap), [ordersMap]);
    const isIdle = (upd) => upd && (new Date() - new Date(upd)) / 60000 > 5;
    const idleCount = activeOrdersArray.filter(o => isIdle(o.lastUpdate)).length;

    const filteredData = useMemo(() => {
        const q = searchQuery.toLowerCase();
        // 🛡️ CEO FIX: Added "|| ''" logic. Now if a name is missing, your app won't crash!
        if (activeTab === 'Riders') return riders.filter(r => (r.userId?.name || '').toLowerCase().includes(q));
        if (activeTab === 'Pasals') return sellers.filter(s => (s.name || '').toLowerCase().includes(q));
        if (activeTab === 'Users') return customers.filter(c => (c.name || '').toLowerCase().includes(q));
        if (activeTab === 'Orders') return allOrders.filter(o => (o._id || '').toLowerCase().includes(q));
        return [];
    }, [searchQuery, activeTab, riders, sellers, customers, allOrders]);

    if (isLoading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-orange-500 font-bold tracking-[0.5em]">HQ INITIALIZING...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-400 font-sans flex flex-col md:flex-row overflow-hidden text-xs">
            <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} setSearchQuery={setSearchQuery} />

            <main className="flex-1 overflow-y-auto bg-gray-950 p-6 custom-scrollbar relative">
                {isProcessing && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="text-orange-500 font-black animate-pulse">SYSTEM PROCESSING... DO NOT CLOSE</div>
                    </div>
                )}

                {isModalOpen && <OrderManifestModal selectedOrder={selectedOrder} setIsModalOpen={setIsModalOpen} />}

                <div className="flex gap-2 mb-6">
                    {idleCount > 0 && (
                        <div className="flex-1 bg-red-600/10 border border-red-600/30 p-2.5 rounded flex items-center justify-between">
                            <span className="text-red-500 font-black uppercase text-[9px]">🚨 {idleCount} RIDERS IDLE</span>
                            <button onClick={() => setActiveTab('Live Tracking')} className="text-[8px] bg-red-600 text-white px-2 py-0.5 rounded">MONITOR</button>
                        </div>
                    )}
                </div>

                <KpiCards stats={stats} fleetSize={riders.length} />

                {['Riders', 'Pasals', 'Users', 'Orders'].includes(activeTab) && (
                    <div className="mb-4">
                        <input 
                            type="text" 
                            placeholder={`Scan ${activeTab} database...`} 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-gray-900 border border-gray-800 p-2.5 px-4 rounded-xl text-xs w-full max-w-md outline-none focus:border-orange-500 text-white transition-all"
                        />
                    </div>
                )}

                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
                    <DataTables 
                        activeTab={activeTab} 
                        filteredData={filteredData} 
                        riders={riders} 
                        handleRestaurantStatus={handleRestaurantStatus} 
                        handleRestaurantOperation={handleRestaurantOperation} 
                        setSelectedOrder={setSelectedOrder} 
                        setIsModalOpen={setIsModalOpen} 
                    />

                    {activeTab === 'Live Tracking' && <LiveTrackingMap activeOrdersArray={activeOrdersArray} isIdle={isIdle} />}

                    {activeTab === 'Financial Hub' && (
                        <FinancialHubView 
                            finHub={finHub} 
                            handleSettlement={handleSettlement} 
                            approveBulkPayout={approveBulkPayout} 
                        />
                    )}

                    {activeTab === 'Overview' && (
                        <div className="p-10 text-center space-y-4">
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Command Center Overview</h2>
                            <p className="text-gray-500">System is fully operational. Nepal logistics are live.</p>
                            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto pt-6">
                                <StatBox label="Daily Momentum" value={`${stats.dailyOrders || 0} Orders`} />
                                <StatBox label="System Profit" value={`NPR ${stats.netProfit || 0}`} />
                                <StatBox label="Liquid Cash" value={`NPR ${stats.availableBalance || 0}`} />
                            </div>

                            {/* 🛠️ SYSTEM TOOLS AREA (For fixing legacy data) */}
                            <div className="mt-12 p-6 bg-purple-900/10 border border-purple-500/20 rounded-2xl max-w-xl mx-auto">
                                <h3 className="text-purple-400 font-black mb-3 uppercase tracking-widest text-sm">🛠️ Admin Maintenance Tools</h3>
                                <p className="text-gray-400 mb-4">Click the button below to upgrade all older Seller accounts to the new active system. This fixes the "Account Disabled" login error instantly.</p>
                                <button 
                                    onClick={handleSyncLegacyData} 
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded font-black tracking-wider transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                                    SYNC & FIX LEGACY SELLERS
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function StatBox({ label, value }) {
    return (
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl">
            <span className="block text-[9px] text-orange-500 font-black mb-2 uppercase">{label}</span>
            <div className="text-xl font-bold text-white">{value}</div>
        </div>
    );
}

export default AdminDashboard;