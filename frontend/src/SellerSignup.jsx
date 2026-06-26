import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import imageCompression from 'browser-image-compression'; 

// Icon Fix for Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 18, { animate: true, duration: 1.5 });
      setTimeout(() => { map.invalidateSize(); }, 400);
    }
  }, [position, map]);
  return null;
}

function SellerSignup() {
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    password: '', 
    phone: '', 
    businessName: '',
    locationName: '',
    panVatNumber: '', 
  });
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [regDocument, setRegDocument] = useState(null); 
  const [isCompressing, setIsCompressing] = useState(false);
  
  const [position, setPosition] = useState([27.5020, 83.6661]); 
  const [isLocating, setIsLocating] = useState(false);
  const markerRef = useRef(null);
  const navigate = useNavigate();

  const handlePhoneInput = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 10) {
      setFormData({ ...formData, phone: val });
    }
  };

  const handleFileProcessing = async (e, setFile) => {
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
      setFile(compressedFile);
      setIsCompressing(false);
    } catch (error) {
      setIsCompressing(false);
    }
  };

  const findMyLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Browser doesn't support GPS");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => {
        alert("GPS Access Denied! Please pin manually.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  function MapEventsHandler() {
    useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); } });
    return null;
  }

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setPosition([newPos.lat, newPos.lng]);
      }
    },
  }), []);

  const handleSellerSignup = async (e) => {
    e.preventDefault();
    const nepalRegex = /^(98|97)\d{8}$/;
    if (!nepalRegex.test(formData.phone)) {
      alert("Invalid Number! Kripya valid Nepali number (98/97 bata suru hune 10 digits) halnuhos.");
      return;
    }
    if (isCompressing) return alert("Hajur, photo compress hudai chha. Kripya ekxin parkhinu...");

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key].trim()));
    data.append('latitude', position[0]);
    data.append('longitude', position[1]);
    data.append('role', 'Seller'); 

    if (selectedImage) data.append('image', selectedImage);
    if (regDocument) data.append('registrationDoc', regDocument);

    try {
      const res = await fetch('http://localhost:5005/api/auth/signup', {
        method: 'POST',
        body: data, 
      });
      if (res.ok) {
        alert("Badhai Chha! 🎉 Pasal saphalatapurvak darta bhayo. Aba login garnuhos.");
        navigate('/login'); 
      } else {
        const result = await res.json();
        alert(result.message || "Registration failed.");
      }
    } catch (err) { 
      alert("Server connection error. Internet check garnuhos!");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-800 relative">
      
      {/* ✨ Back Button Fixed (Non-Floating) */}
      <div className="w-full max-w-4xl mx-auto relative h-0">
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-8 left-8 text-gray-400 hover:text-orange-500 font-black text-xs uppercase tracking-widest transition-all z-[100] active:scale-95"
        >
          Back
        </button>
      </div>

      {/* ✨ Main Wrapper: Pure Edge-to-Edge */}
      <div className="w-full min-h-screen flex flex-col items-center p-6 sm:p-12 lg:p-20">
        
        <div className="w-full max-w-4xl flex flex-col">
          
          <div className="text-center mb-16 mt-16 md:mt-0">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-gray-900 uppercase leading-none">
              Register Your Pasal
            </h2>
            <div className="flex items-center justify-center gap-3 mt-4">
               <p className="text-gray-400 text-xs sm:text-sm font-black uppercase tracking-[0.2em]">Nepal Secure KYC System</p>
               <img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg" className="w-6 h-auto" alt="Nepal" />
            </div>
          </div>
          
          <form onSubmit={handleSellerSignup} className="flex flex-col gap-10">
            
            {/* Section 1: Basic Info */}
            <div className="space-y-6">
              <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Pasal Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <input type="text" placeholder="Owner Full Name" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner transition-all" onChange={(e) => setFormData({...formData, fullName: e.target.value})} required />
                <input type="text" placeholder="Pasal ko Naam" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner transition-all" onChange={(e) => setFormData({...formData, businessName: e.target.value})} required />
                
                <div className="flex gap-0 shadow-inner rounded-2xl overflow-hidden border-2 border-transparent focus-within:border-orange-500 transition-all">
                  <span className="bg-gray-100 px-6 flex items-center text-base font-black text-gray-400">+977</span>
                  <input 
                    type="tel" 
                    maxLength="10" 
                    placeholder="98XXXXXXXX" 
                    value={formData.phone}
                    onChange={handlePhoneInput}
                    className="p-5 bg-gray-50 w-full outline-none font-bold text-base" 
                    required 
                  />
                </div>
                <input type="text" placeholder="City Name (e.g. Parasi, Kathmandu)" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner" onChange={(e) => setFormData({...formData, locationName: e.target.value})} required />
              </div>
            </div>

            {/* Section 2: Documents */}
            <div className="bg-gray-50 p-8 sm:p-12 rounded-[3rem] border-2 border-dashed border-gray-200 space-y-10 shadow-sm">
               <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                 Legal KYC Verification 🛡️
               </h3>
               
               <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Business Registration</label>
                    <input type="text" placeholder="PAN or VAT Number" className="w-full p-5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm" onChange={(e) => setFormData({...formData, panVatNumber: e.target.value})} required />
                    <div className="bg-white p-6 rounded-xl border border-gray-100 text-center shadow-sm">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-3 underline decoration-orange-500">Darta Praman-Patra (Document)</label>
                      <input type="file" accept="image/*" className="w-full text-[10px] font-bold" onChange={(e) => handleFileProcessing(e, setRegDocument)} required />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Pasal Preview</label>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-[178px] flex flex-col justify-center text-center">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-3 underline decoration-orange-500">Pasal ko Photo</label>
                      <input type="file" accept="image/*" className="w-full text-[10px] font-bold" onChange={(e) => handleFileProcessing(e, setSelectedImage)} required />
                    </div>
                 </div>
               </div>
            </div>

            {/* Section 3: Map Section */}
            <div className="space-y-6">
              <div className="flex justify-between items-center ml-1">
                <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                  Select Your Pasal Location 🎯
                </h3>
                <button type="button" onClick={findMyLocation} className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-4 py-2 rounded-full active:scale-95 transition-all shadow-sm">
                  {isLocating ? "Syncing..." : "Auto Pin"}
                </button>
              </div>
              <div className="h-[400px] w-full rounded-[3rem] overflow-hidden border-4 border-gray-50 shadow-2xl z-0 ring-1 ring-gray-100">
                <MapContainer center={position} zoom={18} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapEventsHandler />
                  <RecenterMap position={position} />
                  <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef} />
                </MapContainer>
              </div>
            </div>

            {/* Section 4: Security */}
            <div className="space-y-6 border-t border-gray-100 pt-10">
              <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Account Security</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <input type="email" placeholder="Business Email" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner" onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                <input type="password" placeholder="Create Password" className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-base shadow-inner" onChange={(e) => setFormData({...formData, password: e.target.value})} required />
              </div>
            </div>
            
            <button 
              disabled={isCompressing} 
              className={`w-full text-white font-black py-6 rounded-3xl transition-all shadow-[0_20px_50px_rgba(234,88,12,0.3)] uppercase tracking-[0.2em] text-base mt-10 mb-6 ${isCompressing ? 'bg-orange-300' : 'bg-orange-600 hover:bg-gray-900 active:scale-95'}`}
            >
              {isCompressing ? "Security Processing..." : "Register"}
            </button>
          </form>

          <div className="mt-12 mb-20 text-center flex flex-col items-center gap-2">
              <p className="text-xs text-gray-400 font-black uppercase tracking-widest">
                  Already a partner?
              </p>
              <Link 
                  to="/login" 
                  className="text-orange-500 hover:text-gray-900 font-black uppercase text-xs tracking-widest transition-colors border-b-2 border-orange-500 pb-1"
              >
                  Login here
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SellerSignup;