import React, { useState } from 'react';

function RiderWalletTab({ walletBalance }) {
  // 🚀 STATES for Real Database History
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 🚀 FETCH REAL HISTORY FROM DATABASE
  const fetchWalletHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      // Ensure this endpoint exists in your backend to fetch rider's actual transaction history
      const res = await fetch('http://localhost:5005/api/rider/wallet/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Assuming the backend returns an array of transactions in data.history
        if (data.success && data.history) {
          setHistoryData(data.history);
        }
      } else {
        console.error("Failed to fetch wallet history from DB");
      }
    } catch (err) {
      console.error("Network error while fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 🚀 ENGINE SYNC: Native Back-Button Handling
  const openHistory = () => {
    setShowHistoryModal(true);
    window.history.pushState({ modal: true }, "", window.location.hash);
    fetchWalletHistory(); // Fetch fresh data from DB every time the modal opens
  };

  const closeHistory = () => {
    setShowHistoryModal(false);
    if (window.history.state?.modal) {
      window.history.back(); // Reverts the fake history state
    }
  };

  // Helper function to format dates from MongoDB
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <>
      <div className="space-y-4 relative">
        {/* Cash Deposit Block (COD) */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-lg text-white">
          <p className="text-sm opacity-90 mb-1 font-medium">Cash to Deposit (COD)</p>
          <h2 className="text-3xl font-black">NPR {(walletBalance / 100).toFixed(2)}</h2>
          <p className="text-xs opacity-80 mt-2">This is the cash you collected from customers. Please deposit it to the company.</p>
        </div>
        
        {/* Earnings Block */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Today's Earnings</p>
          <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">NPR --</h2>
          <p className="text-xs text-gray-400 mt-1">Earnings feature will be live soon.</p>
        </div>

        {/* 🚀 UPGRADED: Premium Thin List Action Menu (Withdraw removed) */}
        <div className="mt-8 space-y-3">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2 mb-2">Wallet Details</h3>
          
          <button 
            onClick={openHistory}
            className="w-full flex items-center justify-between bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.98] shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center text-lg">
                📜
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900 dark:text-white">Transaction History</p>
                <p className="text-[10px] font-medium text-gray-500 mt-0.5">View real-time payouts & deposits</p>
              </div>
            </div>
            <span className="text-gray-300 dark:text-gray-600 font-bold pr-2 text-lg">➔</span>
          </button>
        </div>
      </div>

      {/* 🚀 REAL-TIME DB HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0 md:pb-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md h-[75vh] md:h-auto md:max-h-[80vh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-slide-up relative overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-10">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Transaction History</h3>
              <button onClick={closeHistory} className="app-close-btn w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 font-bold flex items-center justify-center hover:bg-gray-200 transition">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-50 dark:bg-[#0a0a0a]">
              
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-gray-500 mt-4">Syncing with database...</p>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-10">
                  <span className="text-4xl block mb-2 opacity-50">📂</span>
                  <p className="text-sm font-bold text-gray-500">No transactions found.</p>
                  <p className="text-xs text-gray-400 mt-1">Your recent earnings and deposits will appear here.</p>
                </div>
              ) : (
                historyData.map((tx, index) => (
                  <div key={tx._id || index} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md transition">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">{formatDate(tx.createdAt || tx.date)}</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{tx.description || tx.type}</p>
                    </div>
                    <div className="text-right">
                      {/* Assuming tx.transactionType is 'credit' or 'debit' */}
                      <p className={`text-lg font-black ${tx.transactionType === 'debit' ? 'text-red-500' : 'text-green-500'}`}>
                        {tx.transactionType === 'debit' ? '-' : '+'} NPR {tx.amount}
                      </p>
                      <p className={`text-[10px] font-bold uppercase mt-1 tracking-wider ${
                        tx.status === 'completed' || tx.status === 'settled' ? 'text-green-600' : 'text-orange-500'
                      }`}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
              
              {!isLoadingHistory && historyData.length > 0 && (
                <div className="text-center py-6">
                  <p className="text-xs font-bold text-gray-400">End of records.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default RiderWalletTab;