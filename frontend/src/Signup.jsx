import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Signup() {
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    
    const phoneRegex = /^9\d{9}$/; 
    if (!phoneRegex.test(formData.phone)) {
      alert("⚠️ Security Alert: Kripya sahi Nepali mobile number (10 digits, starting with 9) halnuhos.");
      return; 
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5005/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData), 
      });
      
      if (res.ok) {
        alert("Swagat Chha! 🥘 Account created successfully. Login garera mitho khana order garnuhos.");
        navigate('/login');
      } else {
        const data = await res.json();
        alert(data.message || "Signup failed. Please try again.");
      }
    } catch (err) { 
      console.error("Signup error:", err); 
      alert("Server error. Please ensure your backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    // ✨ Everywhere Full Screen (Laptop + Mobile)
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-800 relative overflow-y-auto">
      
      {/* ✨ Back Button (Non-Floating, No Arrow) */}
      <div className="w-full max-w-4xl mx-auto relative h-0">
        <button 
          onClick={() => navigate('/')} 
          className="absolute top-8 left-8 text-gray-400 hover:text-orange-500 font-black text-xs uppercase tracking-widest transition-all z-[100] active:scale-95"
        >
          Back
        </button>
      </div>

      {/* ✨ Main Wrapper: Full Screen like Rider/Seller Registration */}
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 lg:p-20">
        
        {/* Wide Container for Pro Look */}
        <div className="w-full max-w-4xl flex flex-col">
          
          <div className="text-center mb-16 mt-16 md:mt-0">
            <div className="inline-block bg-orange-50 p-6 rounded-[2.5rem] mb-8 text-6xl shadow-inner">🥘</div>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-gray-900 uppercase leading-none">
              Create New Account
            </h2>
            <div className="flex items-center justify-center gap-3 mt-4">
               <p className="text-gray-400 text-xs sm:text-sm font-black uppercase tracking-[0.2em]">Join Food Samundar Family</p>
               <img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg" className="w-6 h-auto" alt="Nepal" />
            </div>
          </div>
          
          <form onSubmit={handleSignup} className="flex flex-col gap-10">
            
            {/* Grid for Laptop view consistency */}
            <div className="grid md:grid-cols-2 gap-8">
              
              <div className="flex flex-col gap-3">
                <label className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Full Name (Tapai ko Nam)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Ram Bahadur" 
                  className="w-full p-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:border-orange-500 outline-none font-bold text-lg shadow-inner transition-all" 
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
                  required 
                />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  placeholder="example@gmail.com" 
                  className="w-full p-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:border-orange-500 outline-none font-bold text-lg shadow-inner transition-all" 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  required 
                />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Phone (Samparka Namber)</label>
                <div className="flex gap-0 shadow-inner rounded-[2rem] overflow-hidden border-2 border-transparent focus-within:border-orange-500 transition-all">
                  <span className="bg-gray-100 px-6 flex items-center text-lg font-black text-gray-400">+977</span>
                  <input 
                    type="tel" 
                    maxLength="10" 
                    placeholder="98XXXXXXXX" 
                    className="p-6 bg-gray-50 w-full outline-none font-bold text-lg" 
                    onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-black text-orange-500 uppercase tracking-widest ml-1">Create Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full p-6 bg-gray-50 rounded-[2rem] border-2 border-transparent focus:border-orange-500 outline-none font-bold text-lg shadow-inner transition-all" 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  required 
                />
              </div>

            </div>
            
            {/* Button: Register (R capital, baki small, No Arrow) */}
            <button 
              disabled={isLoading}
              className={`w-full text-white font-black py-7 rounded-[2.5rem] transition-all shadow-[0_25px_60px_rgba(234,88,12,0.35)] uppercase tracking-[0.2em] text-lg mt-6 mb-4 ${isLoading ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-600 hover:bg-gray-900 active:scale-95'}`}
            >
              {isLoading ? "Wait..." : "Register"}
            </button>
          </form>

          <div className="mt-12 mb-20 text-center flex flex-col items-center gap-3">
              <p className="text-sm text-gray-400 font-black uppercase tracking-widest">
                  Already have an account?
              </p>
              <Link 
                  to="/login" 
                  className="text-orange-500 hover:text-gray-900 font-black uppercase text-sm sm:text-base border-b-2 border-orange-500 pb-1 px-2 transition-all"
              >
                  Login Now
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;