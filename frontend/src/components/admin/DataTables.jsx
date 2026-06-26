import { useState } from 'react';

export default function DataTables({ activeTab, filteredData, handleRestaurantStatus, handleRestaurantOperation }) {
    // ✨ UNIVERSAL MODAL STATE: Handles Rider, Pasal and Customer modals
    const [modalData, setModalData] = useState(null); 

    // 🚀 UNIVERSAL API HANDLER: One function to control all entities
    const handleEntityAction = async (id, entityType, actionType, item) => {
        // 🏪 RESTAURANT LOGIC 
        if (entityType === 'Pasal') {
            if (actionType === 'APPROVE') {
                handleRestaurantStatus(id, { status: 'ACTIVE', isVerifiedByAdmin: true });
            } else if (actionType === 'SUSPEND') {
                if (!window.confirm("Are you sure you want to SUSPEND this Restaurant?")) return;
                handleRestaurantStatus(id, { status: 'SUSPENDED', isVerifiedByAdmin: false });
            } else if (actionType === 'REJECT') {
                const reason = window.prompt("⚠️ Enter reason for rejection (e.g., Blur Pan Card, Invalid Name):");
                if (!reason) return;
                handleRestaurantStatus(id, { status: 'REJECTED', isVerifiedByAdmin: false, rejectionReason: reason });
            } else if (actionType === 'NUKE') {
                if (window.confirm(`🔥 PERMANENTLY DELETE ${item.name}?`)) {
                    handleRestaurantOperation(id, { isDeleted: true });
                }
            }
            setModalData(null);
            return;
        }

        // 🛵 & 👤 RIDER / CUSTOMER LOGIC 
        try {
            const token = localStorage.getItem('token');
            let body = {};
            let endpoint = `http://localhost:5005/api/admin/riders/${id}/status`; 
            let method = 'PATCH';

            if (actionType === 'APPROVE') {
                body = { status: 'VERIFIED', isActive: true };
            } else if (actionType === 'REJECT') {
                const reason = window.prompt(`⚠️ Enter reason for rejecting this ${entityType}:`);
                if (!reason) return; 
                body = { status: 'REJECTED', isActive: false, rejectionReason: reason };
            } else if (actionType === 'SUSPEND') {
                if (!window.confirm(`Are you sure you want to SUSPEND this ${entityType}?`)) return;
                body = { status: 'SUSPENDED', isActive: false };
            } else if (actionType === 'NUKE') {
                if (!window.confirm(`🔥 WARNING: This will PERMANENTLY DELETE the ${entityType}. Proceed?`)) return;
                endpoint = `http://localhost:5005/api/admin/purge/${entityType.toLowerCase()}/${id}`;
                method = 'DELETE';
            }

            const options = {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            };
            if (method !== 'DELETE') options.body = JSON.stringify(body);

            const res = await fetch(endpoint, options);
            const data = await res.json();
            
            if (res.ok && data.success) {
                alert(`✅ ${entityType} ${actionType} action successful!`);
                setModalData(null);
                window.location.reload(); 
            } else {
                alert(`❌ Error: ${data.error || data.message}`);
            }
        } catch (err) {
            alert('Network Error! Cannot connect to Server.');
        }
    };

    if (!['Riders', 'Pasals', 'Users', 'Orders'].includes(activeTab)) return null;

    return (
        <div className="overflow-x-auto relative">
            <table className="w-full text-left dense-table">
                <thead className="bg-gray-900/50">
                    <tr>
                        {activeTab === 'Pasals' && <><th>ID</th><th>Restaurant</th><th>Status</th><th>Wallet (NPR)</th><th>God Mode Controls</th></>}
                        {activeTab === 'Riders' && <><th>Name & Phone</th><th>KYC Status</th><th>System Status</th><th>Wallet</th><th>God Mode Controls</th></>}
                        {activeTab === 'Users' && <><th>Customer Name</th><th>Email & Phone</th><th>Status</th><th>God Mode Controls</th></>}
                        {activeTab === 'Orders' && <><th>Order ID</th><th>Status</th><th>Amount</th></>}
                    </tr>
                </thead>
                <tbody>
                    {filteredData.map((item, idx) => {
                        // Safe extraction for different item structures
                        const itemId = activeTab === 'Riders' ? item.userId?._id : item._id;
                        const itemStatus = activeTab === 'Pasals' ? item.status : (item.userId?.kycStatus || item.kycStatus || 'PENDING');
                        
                        return (
                        <tr key={item._id || idx} className="hover:bg-gray-800/30 transition-colors border-b border-gray-800">
                            
                            {/* 🏪 RESTAURANT / PASALS VIEW */}
                            {activeTab === 'Pasals' && (
                                <>
                                    <td className="font-mono text-[10px] p-3 text-gray-400">{item._id.slice(-6)}</td>
                                    <td className="font-bold text-white p-3">{item.name}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black ${itemStatus === 'ACTIVE' || itemStatus === 'VERIFIED' ? 'bg-green-500/10 text-green-500' : itemStatus === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                            {itemStatus}
                                        </span>
                                    </td>
                                    <td className="font-mono text-orange-400 font-bold p-3">{(item.walletBalance / 100 || 0).toFixed(2)}</td>
                                    
                                    <td className="flex gap-2 p-3 flex-wrap">
                                        <button onClick={() => setModalData({ type: 'Pasal', data: item })} className="bg-purple-600/20 text-purple-500 border border-purple-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-purple-600 hover:text-white transition">
                                            🔍 VERIFY DOCS
                                        </button>
                                        
                                        {itemStatus !== 'ACTIVE' ? (
                                            <button onClick={() => handleEntityAction(item._id, 'Pasal', 'APPROVE', item)} className="bg-green-600/20 text-green-500 border border-green-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-green-600 hover:text-white transition">APPROVE</button>
                                        ) : (
                                            <button onClick={() => handleEntityAction(item._id, 'Pasal', 'SUSPEND', item)} className="bg-orange-600/20 text-orange-500 border border-orange-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-orange-600 hover:text-white transition">SUSPEND</button>
                                        )}
                                        
                                        {itemStatus !== 'REJECTED' && (
                                            <button onClick={() => handleEntityAction(item._id, 'Pasal', 'REJECT', item)} className="bg-pink-600/20 text-pink-500 border border-pink-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-pink-600 hover:text-white transition">REJECT</button>
                                        )}

                                        <button onClick={() => handleRestaurantOperation(item._id, { isOpen: !item.isOpen })} className="bg-blue-600/20 text-blue-500 border border-blue-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-blue-600 hover:text-white transition">
                                            FORCE {item.isOpen ? 'CLOSE' : 'OPEN'}
                                        </button>

                                        <button onClick={() => handleEntityAction(item._id, 'Pasal', 'NUKE', item)} className="bg-red-600/20 text-red-500 border border-red-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-red-600 hover:text-white transition">NUKE</button>
                                    </td>
                                </>
                            )}

                            {/* 🛵 RIDERS VIEW */}
                            {activeTab === 'Riders' && (
                                <>
                                    <td className="p-3">
                                        <div className="text-white font-bold">{item.userId?.name || 'Unknown'}</div>
                                        <div className="text-[10px] text-gray-400">{item.userId?.phone}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${itemStatus === 'VERIFIED' ? 'bg-green-500/10 text-green-500' : itemStatus === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                            {itemStatus}
                                        </span>
                                    </td>
                                    
                                    {/* 🚀 CEO UPDATE: Now showing both Admin Approval AND Live Presence */}
                                    <td className="p-3 space-y-1">
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black text-center uppercase ${item.userId?.isActive ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                            {item.userId?.isActive ? 'APPROVED' : 'LOCKED'}
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black text-center uppercase ${item.userId?.isOnline ? 'bg-green-500/10 text-green-600 animate-pulse' : 'bg-red-500/10 text-red-500'}`}>
                                            {item.userId?.isOnline ? '● LIVE ONLINE' : '○ OFFLINE'}
                                        </div>
                                    </td>

                                    <td className="p-3 font-mono text-orange-400">{(item.walletBalance / 100 || 0).toFixed(2)}</td>
                                    
                                    <td className="flex gap-2 p-3 flex-wrap">
                                        <button onClick={() => setModalData({ type: 'Rider', data: item })} className="bg-purple-600/20 text-purple-500 border border-purple-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-purple-600 hover:text-white transition">
                                            🔍 VERIFY DOCS
                                        </button>
                                        
                                        {itemStatus !== 'VERIFIED' ? (
                                            <button onClick={() => handleEntityAction(itemId, 'Rider', 'APPROVE')} className="bg-green-600/20 text-green-500 border border-green-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-green-600 hover:text-white transition">APPROVE</button>
                                        ) : (
                                            <button onClick={() => handleEntityAction(itemId, 'Rider', 'SUSPEND')} className="bg-orange-600/20 text-orange-500 border border-orange-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-orange-600 hover:text-white transition">SUSPEND</button>
                                        )}
                                        
                                        {itemStatus !== 'REJECTED' && (
                                            <button onClick={() => handleEntityAction(itemId, 'Rider', 'REJECT')} className="bg-pink-600/20 text-pink-500 border border-pink-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-pink-600 hover:text-white transition">REJECT</button>
                                        )}

                                        <button onClick={() => handleEntityAction(itemId, 'Rider', 'NUKE')} className="bg-red-600/20 text-red-500 border border-red-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-red-600 hover:text-white transition">NUKE</button>
                                    </td>
                                </>
                            )}

                            {/* 👤 USERS / CUSTOMERS VIEW (AUTO-VERIFIED) */}
                            {activeTab === 'Users' && (
                                <>
                                    <td className="p-3 text-white font-bold">{item.name || 'Unknown'}</td>
                                    <td className="p-3 text-gray-400 text-[10px]"><div>{item.email}</div><div>{item.phone}</div></td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${item.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {item.isActive ? 'ACTIVE' : 'BANNED'}
                                        </span>
                                    </td>
                                    
                                    <td className="flex gap-2 p-3 flex-wrap">
                                        <button onClick={() => setModalData({ type: 'User', data: item })} className="bg-purple-600/20 text-purple-500 border border-purple-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-purple-600 hover:text-white transition">
                                            🔍 VIEW PROFILE
                                        </button>
                                        
                                        {/* Customers are auto-verified. Only show UNBAN if they are currently suspended. */}
                                        {!item.isActive ? (
                                            <button onClick={() => handleEntityAction(item._id, 'User', 'APPROVE')} className="bg-green-600/20 text-green-500 border border-green-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-green-600 hover:text-white transition">UNBAN / RESTORE</button>
                                        ) : (
                                            <button onClick={() => handleEntityAction(item._id, 'User', 'SUSPEND')} className="bg-orange-600/20 text-orange-500 border border-orange-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-orange-600 hover:text-white transition">SUSPEND (BAN)</button>
                                        )}
                                        
                                        <button onClick={() => handleEntityAction(item._id, 'User', 'NUKE')} className="bg-red-600/20 text-red-500 border border-red-500/30 px-3 py-1 rounded text-[9px] font-bold hover:bg-red-600 hover:text-white transition">NUKE</button>
                                    </td>
                                </>
                            )}

                            {/* 📦 ORDERS VIEW (Intact) */}
                            {activeTab === 'Orders' && (
                                <>
                                    <td className="p-3 font-mono text-gray-400">{item._id}</td>
                                    <td className="p-3 text-blue-400">{item.status}</td>
                                    <td className="p-3 font-mono">{(item.totalAmount / 100 || 0).toFixed(2)}</td>
                                </>
                            )}
                        </tr>
                    )})}
                    {filteredData.length === 0 && (
                        <tr><td colSpan="6" className="text-center py-10 text-gray-600 font-bold tracking-widest">NO DATA FOUND IN THIS SECTOR</td></tr>
                    )}
                </tbody>
            </table>

            {/* ======================================================== */}
            {/* 📝 UNIVERSAL DOCUMENT VERIFICATION MODAL */}
            {/* ======================================================== */}
            {modalData && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 custom-scrollbar overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative mt-20 mb-20">
                        
                        <button onClick={() => setModalData(null)} className="absolute top-4 right-6 text-gray-400 hover:text-red-500 font-black text-xl">✕</button>
                        
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6">
                            {modalData.type} Verification Hub 🛡️
                        </h2>

                        <div className="grid md:grid-cols-3 gap-6 mb-8 bg-gray-950 p-4 rounded-xl border border-gray-800">
                            <div><span className="block text-[10px] text-gray-500 uppercase font-black">Name</span><span className="text-white font-bold">{modalData.data.name || modalData.data.userId?.name}</span></div>
                            
                            {modalData.type === 'Pasal' && (
                                <>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">PAN/VAT No.</span><span className="text-orange-500 font-bold">{modalData.data.panVatNumber || 'N/A'}</span></div>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">Location</span><span className="text-white font-bold text-xs">{modalData.data.location || 'N/A'}</span></div>
                                </>
                            )}
                            
                            {modalData.type === 'Rider' && (
                                <>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">Phone</span><span className="text-white font-bold">{modalData.data.userId?.phone}</span></div>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">Bike Details</span><span className="text-orange-500 font-bold">{modalData.data.bikeNumber || 'N/A'}</span></div>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">License Number</span><span className="text-white font-bold">{modalData.data.licenseNumber || 'N/A'}</span></div>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">Citizenship No.</span><span className="text-white font-bold">{modalData.data.citizenshipNo || 'N/A'}</span></div>
                                </>
                            )}

                            {modalData.type === 'User' && (
                                <>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">Email</span><span className="text-white font-bold">{modalData.data.email || 'N/A'}</span></div>
                                    <div><span className="block text-[10px] text-gray-500 uppercase font-black">Phone</span><span className="text-white font-bold">{modalData.data.phone || 'N/A'}</span></div>
                                </>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            
                            {modalData.type === 'Pasal' && (
                                <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                                    <span className="block text-[10px] text-orange-500 uppercase font-black mb-2">Restaurant Image</span>
                                    {modalData.data.image ? (
                                        <a href={modalData.data.image} target="_blank" rel="noopener noreferrer">
                                            <img src={modalData.data.image} alt="Restaurant" className="w-full h-48 object-cover rounded shadow-lg hover:opacity-80 transition cursor-pointer" />
                                        </a>
                                    ) : <div className="w-full h-48 flex items-center justify-center bg-gray-900 rounded text-gray-600 font-black text-xs">NO IMAGE</div>}
                                </div>
                            )}

                            {modalData.type === 'Rider' && ['citizenshipFront', 'citizenshipBack', 'licenseFront', 'bluebookImage'].map((docKey) => {
                                const docUrl = modalData.data.documents?.[docKey];
                                return (
                                    <div key={docKey} className="bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                                        <span className="block text-[10px] text-orange-500 uppercase font-black mb-2">{docKey.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        {docUrl ? (
                                            <a href={docUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={docUrl} alt={docKey} className="w-full h-48 object-cover rounded shadow-lg hover:opacity-80 transition cursor-pointer" />
                                            </a>
                                        ) : (
                                            <div className="w-full h-48 flex items-center justify-center bg-gray-900 rounded text-gray-600 font-black text-xs">NOT UPLOADED</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* 👉 MODAL ACTION BUTTONS */}
                        <div className="flex justify-end gap-4 border-t border-gray-800 pt-6">
                            {modalData.type !== 'User' && (
                                <button onClick={() => handleEntityAction(modalData.type === 'Rider' ? modalData.data.userId._id : modalData.data._id, modalData.type, 'REJECT', modalData.data)} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded font-black tracking-widest text-xs transition-all">
                                    ❌ REJECT & REQUIRE FIX
                                </button>
                            )}
                            
                            {/* For Users, if they are suspended, show UNBAN button. For others, show APPROVE */}
                            {(modalData.type !== 'User' || !modalData.data.isActive) && (
                                <button onClick={() => handleEntityAction(modalData.type === 'Rider' ? modalData.data.userId._id : modalData.data._id, modalData.type, 'APPROVE', modalData.data)} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-black tracking-widest text-xs transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                    {modalData.type === 'User' ? '✅ UNBAN / RESTORE' : `✅ APPROVE ${modalData.type.toUpperCase()}`}
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}