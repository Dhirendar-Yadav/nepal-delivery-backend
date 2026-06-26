import React, { useState, useEffect } from 'react';

function RiderProfileTab({ riderName, riderDetails }) {
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [updateForm, setUpdateForm] = useState({ phone: '', email: '', bikeNumber: '' });
  const [showOtpField, setShowOtpField] = useState(false);
  const [otp, setOtp] = useState('');
  const [updateMessage, setUpdateMessage] = useState(null);

  // 🚀 NEW: State for Full-Screen Image Modal
  const [previewImage, setPreviewImage] = useState({ isOpen: false, url: '', title: '' });

  // 🚀 NEW: Smart Back Button / Swipe Handler
  useEffect(() => {
    const handlePopState = (e) => {
      // Agar modal khula hai aur user ne back dabaya, toh sirf modal band karo, page back mat karo
      if (previewImage.isOpen) {
        setPreviewImage({ isOpen: false, url: '', title: '' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [previewImage.isOpen]);

  const openModal = (url, title) => {
    if (!url || url === 'Loading...') {
      return alert(`${title} is not uploaded or currently unavailable.`);
    }
    setPreviewImage({ isOpen: true, url, title });
    // Fake push state takki back button trap ho jaye
    window.history.pushState({ modal: true }, "");
  };

  const closeModal = () => {
    setPreviewImage({ isOpen: false, url: '', title: '' });
    // 🚀 THE FIX: history.back() ki jagah hum state ko silently replace kar rahe hain
    // Isse 'popstate' event fire nahi hoga aur Dashboard confuse hoke Home par nahi jayega.
    if (window.history.state?.modal) {
      window.history.replaceState({ page: 'dashboard' }, "");
    }
  };

  const startProfileUpdate = () => {
    setUpdateForm({
      phone: riderDetails.phone,
      email: riderDetails.email,
      bikeNumber: riderDetails.bikeNumber
    });
    setIsUpdatingProfile(true);
    setUpdateMessage(null);
    setShowOtpField(false);
    setOtp('');
  };

  const submitProfileUpdate = (e) => {
    e.preventDefault();
    if (updateForm.phone !== riderDetails.phone || updateForm.email !== riderDetails.email) {
      setShowOtpField(true);
      alert("A 4-digit OTP has been sent to your new contact details.");
    } else {
      finalizeUpdate();
    }
  };

  const verifyOtpAndSubmit = (e) => {
    e.preventDefault();
    if (otp.length < 4) return alert("Please enter a valid OTP.");
    finalizeUpdate();
  };

  const finalizeUpdate = () => {
    setUpdateMessage("✅ Your request has been submitted. Please wait 2-3 hours for Admin verification and approval.");
    setTimeout(() => {
      setIsUpdatingProfile(false);
      setUpdateMessage(null);
      setShowOtpField(false);
    }, 5000);
  };

  if (updateMessage) {
    return (
      <div className="bg-white dark:bg-gray-900 py-16 px-4 rounded-2xl text-center shadow-sm border border-green-500/50">
        <div className="text-5xl mb-4">⏳</div>
        <h3 className="font-bold text-gray-800 dark:text-white text-lg">Verification Pending</h3>
        <p className="text-sm text-gray-500 mt-2">{updateMessage}</p>
      </div>
    );
  }

  if (isUpdatingProfile) {
    return (
      <div className="bg-white dark:bg-gray-900 p-5 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Update Information</h2>
          <button onClick={() => setIsUpdatingProfile(false)} className="text-gray-500 text-sm font-bold">Cancel</button>
        </div>
        {!showOtpField ? (
          <form onSubmit={submitProfileUpdate} className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-900 mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Changes to Phone or Email will require OTP verification.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
              <input type="text" value={updateForm.phone} onChange={(e) => setUpdateForm({ ...updateForm, phone: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white p-3 rounded-xl text-sm outline-none focus:border-orange-500" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
              <input type="email" value={updateForm.email} onChange={(e) => setUpdateForm({ ...updateForm, email: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white p-3 rounded-xl text-sm outline-none focus:border-orange-500" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Active Vehicle Number</label>
              <input type="text" value={updateForm.bikeNumber} onChange={(e) => setUpdateForm({ ...updateForm, bikeNumber: e.target.value.toUpperCase() })} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white p-3 rounded-xl text-sm outline-none focus:border-orange-500 uppercase font-mono" required />
            </div>
            <button type="submit" className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-orange-600 mt-4">Continue</button>
          </form>
        ) : (
          <form onSubmit={verifyOtpAndSubmit} className="space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter the 4-digit OTP sent to your new contact details.</p>
              <input type="text" maxLength="4" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="0000" className="w-32 text-center bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white p-4 rounded-xl text-2xl tracking-[0.5em] font-mono outline-none focus:border-orange-500 mx-auto" required />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-green-700 mt-2">Verify & Submit Request</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 p-5 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 relative">
        <button onClick={startProfileUpdate} className="absolute top-6 right-6 text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-orange-500 hover:text-white transition-all z-10">
          ✏️ Update Info
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-2xl border-2 border-orange-500/20">👤</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{riderName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${riderDetails.isVerified ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {riderDetails.isVerified ? 'Verified Account' : 'Verification Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 UPGRADED: Premium List Layout */}
        <div className="space-y-6">
          
          {/* Basic Info Group */}
          <div>
            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">Contact Details</h3>
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs font-bold text-gray-500 uppercase">Email Address</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">{riderDetails.email}</span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-bold text-gray-500 uppercase">Mobile Number</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">{riderDetails.phone}</span>
              </div>
            </div>
          </div>

          {/* Vehicles & Documents Group */}
          <div>
            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1 mt-8">Vehicles & Legal Documents</h3>
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              
              <div className="flex justify-between items-center p-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Vehicle Number</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{riderDetails.bikeNumber}</p>
                </div>
                <button onClick={() => openModal(riderDetails.bluebookDoc, 'Bluebook / RC')} className="text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-400 px-4 py-2 rounded-lg hover:bg-orange-200 transition">
                  View Bluebook
                </button>
              </div>

              <div className="flex justify-between items-center p-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">License Number</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{riderDetails.licenseNumber}</p>
                </div>
                <button onClick={() => openModal(riderDetails.licenseFront, 'Driving License')} className="text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-400 px-4 py-2 rounded-lg hover:bg-orange-200 transition">
                  View License
                </button>
              </div>

              <div className="flex justify-between items-center p-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Citizenship No.</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-200 uppercase">{riderDetails.citizenshipNo}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openModal(riderDetails.citizenshipFront, 'Citizenship (Front)')} className="text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-400 px-4 py-2 rounded-lg hover:bg-orange-200 transition">
                    Front
                  </button>
                  <button onClick={() => openModal(riderDetails.citizenshipBack, 'Citizenship (Back)')} className="text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-400 px-4 py-2 rounded-lg hover:bg-orange-200 transition">
                    Back
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {previewImage.isOpen && (
        <div 
          id="image-preview-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
        >
          {/* INJECTED class for Dashboard universal trap. Using standard replaceState now. */}
          <button onClick={closeModal} className="app-close-btn absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full hidden md:flex items-center justify-center transition-all z-50">
            ✕
          </button>
          
          <div className="app-close-btn hidden" onClick={closeModal}></div>

          <p className="absolute top-8 text-white/40 text-[10px] font-bold tracking-widest uppercase md:hidden animate-pulse">
            Swipe Back or Tap anywhere to Close
          </p>

          <div 
            className="max-w-4xl w-full flex flex-col items-center justify-center cursor-pointer md:cursor-default h-full relative z-10"
            onClick={(e) => {
              if(e.target === e.currentTarget) closeModal();
            }}
          >
            <img 
              src={previewImage.url} 
              alt={previewImage.title} 
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/10 pointer-events-none"
            />
            <p className="text-white font-black mt-6 text-lg tracking-widest uppercase bg-white/10 px-6 py-2 rounded-full border border-white/10">
              {previewImage.title}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default RiderProfileTab;