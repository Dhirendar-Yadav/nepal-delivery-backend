import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import imageCompression from 'browser-image-compression'; 

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

function RiderSignup() {
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    password: '', 
    phone: '', 
    licenseNumber: '', 
    citizenshipNo: '', 
    nidNumber: '', 
  });

  const [bikeParts, setBikeParts] = useState({
    zone: 'BA', lot: '', cat: 'PA', num: ''
  });

  const [images, setImages] = useState({
    citizenshipFront: null,
    citizenshipBack: null,
    licenseFront: null,
    nidDoc: null,
    bluebookImage: null
  });

  const [isCompressing, setIsCompressing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const zones = ["BA", "LU", "KO", "ME", "GA", "DH", "NA", "JA", "SA", "RA", "BE", "KA", "SE", "MA"];
  const categories = ["PA", "P", "K", "CHA", "HA"];

  const handleFileProcessing = async (e, key) => {
    const imageFile = e.target.files[0];
    if (!imageFile) return;
    if (!imageFile.type.startsWith('image/')) {
      alert("Kripya image file मात्र upload garnuhos!");
      return;
    }
    const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1280, useWebWorker: true };
    try {
      setIsCompressing(true);
      const compressedFile = await imageCompression(imageFile, options);
      setImages(prev => ({ ...prev, [key]: compressedFile }));
      setIsCompressing(false);
    } catch (error) {
      setIsCompressing(false);
    }
  };

  const handleLicenseChange = (e) => {
    let val = e.target.value.replace(/\D/g, ""); 
    if (val.length > 12) val = val.slice(0, 12); 
    let formatted = val;
    if (val.length > 2 && val.length <= 4) {
      formatted = `${val.slice(0, 2)}-${val.slice(2)}`;
    } else if (val.length > 4) {
      formatted = `${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4)}`;
    }
    setFormData({ ...formData, licenseNumber: formatted });
  };

  const handleRiderSignup = async (e) => {
    e.preventDefault();
    if (isCompressing) return alert("Hajur, documents optimize hudai chha. Kripya ekxin parkhinu...");

    const nepalPhoneRegex = /^(97|98)\d{8}$/;
    if (!nepalPhoneRegex.test(formData.phone)) {
      alert("Kripya sahi Nepal mobile number halnuhos (98/97 bata suru hune 10 digits).");
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key].trim()));
    data.append('bikeNumber', `${bikeParts.zone} ${bikeParts.lot} ${bikeParts.cat} ${bikeParts.num}`);
    data.append('phone', `+977${formData.phone}`);
    data.append('role', 'Rider'); 

    Object.keys(images).forEach(key => {
      if (images[key]) data.append(key, images[key]);
    });

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/rider/signup`, {
        method: 'POST',
        body: data, 
      });
      const result = await res.json();
      if (res.ok) {
        alert("Badhai Chha! 🎉 Application submitted. Aba login garnuhos.");
        navigate('/login'); 
      } else {
        alert(result.message || "Registration failed.");
      }
    } catch (err) { 
      alert("Server error. Connection check garnuhos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-800 relative">
      
      {/* ✨ Back Button Fixed: "fixed" se "absolute" kar diya hai taaki tairna band kare ✨ */}
      <div className="w-full max-w-4xl mx-auto relative h-0">
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-8 left-8 text-gray-400 hover:text-orange-500 font-black text-xs uppercase tracking-widest transition-all z-20 active:scale-95"
        >
          Back
        </button>
      </div>

      <div className="w-full min-h-screen flex flex-col items-center p-6 sm:p-12 lg:p-20">
        
        <div className="w-full max-w-4xl flex flex-col">
          
          <div className="text-center mb-16 mt-16 md:mt-0">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-gray-900 uppercase leading-none">
              Rider Registration
            </h2>
            <div className="flex items-center justify-center gap-3 mt-4">
               <p className="text-gray-400 text-xs sm:text-sm font-black uppercase tracking-[0.2em]">Nepal Secure KYC System</p>
               <img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg" className="w-6 h-auto" alt="Nepal" />
            </div>
          </div>
          
          <form onSubmit={handleRiderSignup} className="flex flex-col gap-10">
            
            <div className="space-y-6">
              <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Personal Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <input 
                  type="text" 
                  placeholder="Full Legal Name" 
                  className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base transition-all shadow-inner" 
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
                  required 
                />
                <div className="flex gap-0 shadow-inner rounded-2xl overflow-hidden border-2 border-transparent focus-within:border-orange-500 transition-all">
                  <span className="bg-gray-100 px-6 flex items-center text-base font-black text-gray-400">+977</span>
                  <input 
                    type="tel" 
                    maxLength="10" 
                    placeholder="98XXXXXXXX" 
                    className="p-5 bg-gray-50 w-full outline-none font-bold text-base" 
                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, "")})} 
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 sm:p-12 rounded-[3rem] border-2 border-dashed border-gray-200 space-y-10 shadow-sm">
               <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                 Government ID Verification 🛡️
               </h3>
               
               <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Citizenship Info</label>
                    <input 
                      type="text" 
                      placeholder="Citizenship Number" 
                      className="w-full p-4 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm" 
                      onChange={(e) => setFormData({...formData, citizenshipNo: e.target.value})} 
                      required 
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-100 text-center shadow-sm">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-3 underline decoration-orange-500">Citizenship Front</label>
                        <input type="file" accept="image/*" className="w-full text-[10px] font-bold" onChange={(e) => handleFileProcessing(e, 'citizenshipFront')} required />
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 text-center shadow-sm">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-3 underline decoration-orange-500">Citizenship Back</label>
                        <input type="file" accept="image/*" className="w-full text-[10px] font-bold" onChange={(e) => handleFileProcessing(e, 'citizenshipBack')} required />
                      </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">License Info</label>
                    <input 
                      type="text" 
                      placeholder="License No: 00-00-00000000" 
                      value={formData.licenseNumber} 
                      className="w-full p-4 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm" 
                      onChange={handleLicenseChange} 
                      required 
                    />
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-[104px] flex flex-col justify-center">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-3 underline decoration-orange-500">License Front Photo</label>
                      <input type="file" accept="image/*" className="w-full text-[10px] font-bold" onChange={(e) => handleFileProcessing(e, 'licenseFront')} required />
                    </div>
                 </div>
               </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-black text-orange-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                Vehicle Details & Bluebook 🏍️
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <select className="p-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none appearance-none cursor-pointer" value={bikeParts.zone} onChange={(e) => setBikeParts({...bikeParts, zone: e.target.value})}>
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <input type="number" placeholder="Lot" className="p-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none shadow-inner" onChange={(e) => setBikeParts({...bikeParts, lot: e.target.value})} required />
                <select className="p-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none appearance-none cursor-pointer" value={bikeParts.cat} onChange={(e) => setBikeParts({...bikeParts, cat: e.target.value})}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" maxLength="4" placeholder="Number" className="p-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none shadow-inner" onChange={(e) => setBikeParts({...bikeParts, num: e.target.value})} required />
              </div>
              <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed border-gray-200 text-center">
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-3">Bluebook Front Page Photo</label>
                  <input type="file" accept="image/*" className="w-full text-xs font-bold max-w-xs mx-auto" onChange={(e) => handleFileProcessing(e, 'bluebookImage')} required />
              </div>
            </div>

            <div className="space-y-6 border-t border-gray-100 pt-10">
              <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Account Security</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <input type="email" placeholder="Email Address" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner" onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                <input type="password" placeholder="Create Password" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner" onChange={(e) => setFormData({...formData, password: e.target.value})} required />
              </div>
            </div>
            
            <button 
              disabled={isLoading || isCompressing} 
              className={`w-full text-white font-black py-6 rounded-3xl transition-all shadow-[0_20px_50px_rgba(234,88,12,0.3)] uppercase tracking-[0.2em] text-base mt-10 mb-6 ${isLoading || isCompressing ? 'bg-orange-300' : 'bg-orange-600 hover:bg-gray-900 active:scale-95'}`}
            >
              {isCompressing ? "OPTIMIZING DOCUMENTS..." : isLoading ? "SUBMITTING..." : "Register"}
            </button>
          </form>

          <div className="mt-12 mb-20 text-center flex flex-col items-center gap-2">
              <p className="text-xs text-gray-400 font-black uppercase tracking-widest">
                  Already a rider?
              </p>
              <Link 
                  to="/login" 
                  className="text-orange-500 hover:text-gray-900 font-black uppercase text-xs tracking-widest transition-colors border-b-2 border-orange-500 pb-1"
              >
                  Login Now
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiderSignup;
