export default function FinancialHubView({ finHub, handleSettlement, approveBulkPayout }) {
    return (
        <div className="p-6 space-y-6">
            <h2 className="text-xl font-black text-white uppercase border-b border-gray-800 pb-2">Financial Settlement Hub</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* RIDER PAYOUTS */}
                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Pending Rider Payouts</h3>
                        <button onClick={() => approveBulkPayout('RIDER')} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-black transition">
                            BULK SETTLE RIDERS
                        </button>
                    </div>
                    {finHub.pendingRiderPayouts?.map((r, i) => (
                        <div key={i} className="flex justify-between border-b border-gray-800 py-2 text-xs">
                            <span className="text-white">{r.userId?.name}</span>
                            <span className="font-mono text-green-400">NPR {(r.wallet?.balance / 100).toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                {/* RESTAURANT SETTLEMENTS */}
                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Pending Restaurant Settlements</h3>
                        <button onClick={() => approveBulkPayout('SELLER')} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-black transition">
                            BULK SETTLE PASALS
                        </button>
                    </div>
                    {finHub.pendingSellerSettlements?.map((s, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-gray-800 py-2 text-xs">
                            <span className="text-white">{s.name}</span>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-green-400">NPR {(s.walletBalance / 100).toFixed(2)}</span>
                                <button onClick={() => handleSettlement(s._id, s.walletBalance)} className="text-[9px] bg-gray-800 px-2 py-1 rounded hover:text-white">Pay Manual</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}