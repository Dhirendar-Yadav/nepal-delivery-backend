import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom'; 

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

function Home() {
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCEOProfile, setShowCEOProfile] = useState(false); 
  const [isFilterOpen, setIsFilterOpen] = useState(false); 
  const navigate = useNavigate(); 

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSorts, setSelectedSorts] = useState([]); 
  const [isPureVeg, setIsPureVeg] = useState(false); 
  const [selectedCategories, setSelectedCategories] = useState([]); 
  const [userLocation, setUserLocation] = useState(null);

  const sortOptions = [
    { id: 'Nearest', label: 'Nearest to Me' },
    { id: 'Rating', label: 'Top Rated' }
  ];

  // Fetching user coordinates for proximity sorting
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("GPS Permission Denied.")
      );
    }
  }, []);

  // Fetching real data from the backend API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/restaurants`);
        const data = await response.json();
        if (response.ok) setRestaurants(data);
      } catch (error) { console.error("API connection error:", error); }
      finally { setIsLoading(false); }
    };
    fetchRestaurants();
  }, []);

  const handleRestaurantClick = (id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Please log in to place an order!");
      navigate('/login');
    } else {
      navigate(`/menu/${id}`);
    }
  };

  // Haversine formula to calculate distance between two coordinates in km
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999; 
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toggleSelection = (item, setState) => {
    setState(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedSorts([]);
    setIsPureVeg(false);
  };

  // ✨ DYNAMIC CATEGORIES & ICONS LOGIC (Architect Level)
  // Only displays icons/categories that actually exist in the fetched restaurant data
  const { dynamicIcons, dynamicSidebarCategories } = useMemo(() => {
    if (!restaurants || restaurants.length === 0) return { dynamicIcons: [], dynamicSidebarCategories: [] };

    const availableKeywords = new Set();
    
    restaurants.forEach(r => {
      if (r.foodType) availableKeywords.add(r.foodType.toLowerCase().trim());
      if (r.menu && Array.isArray(r.menu)) {
        r.menu.forEach(item => {
          if (item.name) availableKeywords.add(item.name.toLowerCase().trim());
        });
      }
    });

    const masterIconList = [
      { name: 'Momo', icon: '🥟', keyword: 'momo' },
      { name: 'Pizza', icon: '🍕', keyword: 'pizza' },
      { name: 'Burger', icon: '🍔', keyword: 'burger' },
      { name: 'Biryani', icon: '🍛', keyword: 'biryani' },
      { name: 'Bakery', icon: '🍰', keyword: 'bakery' },
      { name: 'Sweets', icon: '🍩', keyword: 'sweets' },
      { name: 'Cafe', icon: '☕', keyword: 'cafe' },
      { name: 'Fast Food', icon: '🍟', keyword: 'fast food' }
    ];

    // Filter master list: only keep items where the keyword exists in our database
    const activeIcons = masterIconList.filter(item => {
      // Direct match or partial match in available keywords
      return Array.from(availableKeywords).some(k => k.includes(item.keyword));
    });

    // Extract unique food types for the sidebar
    const uniqueTypes = new Set();
    restaurants.forEach(r => {
      if (r.foodType) {
        // Split by comma in case a restaurant has "Cafe, Bakery"
        r.foodType.split(',').forEach(type => uniqueTypes.add(type.trim()));
      }
    });

    return { 
      dynamicIcons: activeIcons, 
      dynamicSidebarCategories: Array.from(uniqueTypes) 
    };
  }, [restaurants]);

  // Processing Restaurants (Filters, Search, Distance, Mocks for UI)
  const processedRestaurants = restaurants
    .map(r => {
      const dist = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude) : 0;
      
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesName = r.name.toLowerCase().includes(searchLower);
      const matchesType = r.foodType && r.foodType.toLowerCase().includes(searchLower);
      
      const matchedMenuItems = r.menu ? r.menu.filter(item => item.name && item.name.toLowerCase().includes(searchLower)) : [];
      const hasMatchingItem = matchedMenuItems.length > 0;
      
      let badgeText = null;
      if (searchLower !== '' && !matchesName && hasMatchingItem) {
        badgeText = `✨ ${matchedMenuItems[0].name} available here`;
      }

      const isClosedMock = r.name.length % 5 === 0; 
      const offerMock = r.name.length % 3 === 0 ? "🔥 20% OFF" : (r.name.length % 4 === 0 ? "🚚 FREE DELIVERY" : null);

      return { 
        ...r, 
        distance: dist, 
        matchesSearch: matchesName || matchesType || hasMatchingItem || searchLower === '',
        badgeText,
        isOpen: r.isOpen !== undefined ? r.isOpen : !isClosedMock,
        offerTag: r.offerTag || offerMock
      };
    })
    .filter(r => {
      if (!r.matchesSearch) return false;
      const matchesCategory = selectedCategories.length === 0 ? true : 
                              (r.foodType && selectedCategories.some(cat => r.foodType.toLowerCase().includes(cat.toLowerCase())));
      const matchesPureVeg = isPureVeg ? r.isPureVeg === true : true;
      return matchesCategory && matchesPureVeg;
    })
    .sort((a, b) => {
      if (searchQuery.trim() !== '') {
        return a.distance - b.distance;
      }
      for (let sort of selectedSorts) {
        if (sort === 'Rating' && (b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        if (sort === 'Nearest' && a.distance !== b.distance) return a.distance - b.distance;
      }
      return a.distance - b.distance; 
    });

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col animate-pulse overflow-hidden">
      <div className="h-28 sm:h-32 bg-gray-200 w-full"></div>
      <div className="p-3 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-3 bg-gray-200 rounded w-1/2"></div></div>
    </div>
  );

  // CEO Profile Section
  if (showCEOProfile) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 relative">
          <button 
            onClick={() => setShowCEOProfile(false)} 
            className="absolute top-8 left-8 text-gray-400 hover:text-orange-500 font-black text-xs sm:text-sm uppercase tracking-[0.2em] transition-all z-20 active:scale-95"
          >
            Back
          </button>
          <div className="relative mb-12 mt-16 md:mt-0">
            <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gray-900 border-[8px] border-white shadow-2xl flex items-center justify-center text-orange-500 font-black text-6xl sm:text-7xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <span>D</span>
            </div>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-gray-900 uppercase tracking-tighter text-center">Mr. Dhiru Yadav</h2>
          <div className="flex items-center justify-center gap-2 mt-3 mb-10 bg-gray-100 px-5 py-2 rounded-full border border-gray-200 shadow-inner">
            <span className="text-gray-700 font-black text-xs sm:text-sm uppercase tracking-tight">Nepal</span>
            <img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg" className="w-6 h-auto" alt="Nepal" />
          </div>
          <p className="text-[10px] sm:text-[12px] font-black text-orange-500 uppercase tracking-[0.5em] mb-12 border-b-2 border-orange-500 pb-1">CEO & Founder</p>
          <div className="space-y-6 max-w-4xl text-center">
            <h3 className="text-2xl sm:text-4xl font-black text-gray-800 italic leading-tight px-4 sm:px-10">"हाम्रो सेवा, तपाईंको सन्तुष्टि"</h3>
            <div className="h-1.5 w-32 bg-orange-500 mx-auto rounded-full mt-6"></div>
            <p className="text-gray-400 font-bold text-xs sm:text-sm uppercase tracking-widest pt-6 border-t border-gray-100 mt-10">Food Samundar Delivery Services Pvt. Ltd.</p>
          </div>
        </div>
      </div>
    );
  }

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div className="relative mb-6">
        <input type="text" placeholder="Search momo, pizza..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none font-bold text-gray-800 text-sm shadow-inner" />
      </div>
      <div>
        <h3 className="font-black text-gray-900 mb-3 uppercase tracking-widest text-[10px]">Sort By</h3>
        <div className="flex flex-col gap-3">
          {sortOptions.map(opt => (
            <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={selectedSorts.includes(opt.id)} onChange={() => toggleSelection(opt.id, setSelectedSorts)} className="w-4 h-4 accent-orange-500 rounded" />
              <span className="text-sm font-bold text-gray-600 group-hover:text-orange-500">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      <hr className="border-gray-100" />
      <label className="flex items-center gap-3 cursor-pointer group">
        <input type="checkbox" checked={isPureVeg} onChange={(e) => setIsPureVeg(e.target.checked)} className="w-4 h-4 accent-green-600 rounded" />
        <span className="text-sm font-bold text-green-700">Pure Veg 🌱</span>
      </label>
      <hr className="border-gray-100" />
      <div>
        <h3 className="font-black text-gray-900 mb-3 uppercase tracking-widest text-[10px]">Cuisines</h3>
        <div className="grid grid-cols-1 gap-3">
          {dynamicSidebarCategories.length > 0 ? dynamicSidebarCategories.map(cat => (
            <label key={cat} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggleSelection(cat, setSelectedCategories)} className="w-4 h-4 accent-orange-500 rounded" />
              <span className="text-sm font-bold text-gray-600 group-hover:text-orange-500">{cat}</span>
            </label>
          )) : <span className="text-xs text-gray-400 italic">No categories found</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 relative">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm p-4 sticky top-0 z-[60] border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-orange-600 tracking-tighter cursor-pointer" onClick={() => window.location.href = '/'}>Food Samundar</h1>
            <span className="font-black text-[10px] sm:text-sm bg-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-inner ml-2 flex items-center gap-1.5 uppercase tracking-tight text-gray-700">
              Nepal 
              <img src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg" alt="Nepal Flag" className="w-5 h-auto ml-1" loading="eager" />
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <Link to="/rider/signup" className="text-[9px] sm:text-sm font-black text-gray-700 hover:text-orange-600 uppercase">Add Rider</Link>
            <Link to="/seller/signup" className="text-[9px] sm:text-sm font-black text-gray-700 hover:text-orange-600 uppercase">Add Pasal</Link>
            <Link to="/login" className="bg-gray-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-sm font-black hover:bg-orange-500 uppercase">Sign In</Link>
            <div className="flex flex-col items-center gap-0.5 cursor-pointer group p-1" onClick={() => setShowCEOProfile(true)}>
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gray-900 border-2 sm:border-4 border-white shadow-md group-hover:border-orange-500 transition-all flex items-center justify-center text-orange-500 font-black text-[10px] sm:text-lg">D</div>
              <div className="flex flex-col items-center leading-none">
                <p className="text-[8px] sm:text-[11px] font-black text-gray-900 uppercase">Mr. Dhiru</p>
                <p className="text-[7px] sm:text-[9px] font-bold text-orange-600 bg-orange-50 px-1 py-0.5 rounded-full uppercase mt-0.5">CEO</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Banner (Nepali Hook Kept Intact) */}
      <div className="sticky top-[72px] sm:top-[80px] z-50 px-4 py-3 bg-gray-50/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto bg-orange-500 rounded-[2rem] p-6 sm:p-10 text-center shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tighter mb-1">
              भोक लाग्यो ? <span className="animate-bounce inline-block">🤤</span>
            </h2>
            <h3 className="text-lg sm:text-2xl font-black text-orange-100 tracking-tighter">
              अनि अर्डर गर्नुस् न हजुर ! <span className="animate-bounce inline-block ml-1">😉</span>
            </h3>
          </div>
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-8 mt-4">
        
        {/* Left Sidebar */}
        <div className="hidden md:block w-64 lg:w-72 shrink-0">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 sticky top-[230px]">
            <FilterSidebar />
          </div>
        </div>

        {/* Mobile Filter Button */}
        <div className="md:hidden flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4 sticky top-[200px] z-40 backdrop-blur-sm bg-white/95">
          <h3 className="font-black text-gray-900 text-sm">Explore Nearby 🔥</h3>
          <button onClick={() => setIsFilterOpen(true)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg">
            🔍 Filters
          </button>
        </div>

        {/* Right Main Content Area */}
        <div className="flex-1 overflow-hidden">
          
          {/* Dynamic Craving Icons */}
          {dynamicIcons.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">What are you craving?</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {dynamicIcons.map((item) => (
                  <button 
                    key={item.name}
                    onClick={() => toggleSelection(item.keyword, setSelectedCategories)}
                    className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] p-3 rounded-2xl transition-all ${
                      selectedCategories.includes(item.keyword) ? 'bg-orange-100 border-2 border-orange-500 shadow-md transform scale-105' : 'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:bg-orange-50'
                    }`}
                  >
                    <span className="text-3xl mb-1">{item.icon}</span>
                    <span className={`text-[10px] font-black uppercase ${selectedCategories.includes(item.keyword) ? 'text-orange-600' : 'text-gray-600'}`}>
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hidden md:flex justify-between items-end mb-6">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Trending Restaurants 🔥</h3>
            <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">{processedRestaurants.length} Places</span>
          </div>
          
          {/* Short & Professional Empty State */}
          {!isLoading && processedRestaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="text-6xl mb-4 grayscale opacity-50">🍽️</div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Oops! No Matches Found</h3>
              <p className="text-gray-500 font-bold max-w-md">
                We couldn't find any results for "{searchQuery}". Try searching for a different dish or restaurant.
              </p>
              <button onClick={handleClearFilters} className="mt-6 bg-orange-50 text-orange-600 font-black px-8 py-3 rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-sm uppercase text-xs tracking-wider">
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {isLoading ? [...Array(12)].map((_, i) => <SkeletonCard key={i} />) : processedRestaurants.map((restaurant) => (
                <div key={restaurant._id} className={`bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all border border-gray-100 flex flex-col overflow-hidden group active:scale-95 transition-all relative ${!restaurant.isOpen ? 'opacity-80 grayscale-[40%]' : ''}`}>
                  
                  {restaurant.offerTag && (
                    <div className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-br-xl shadow-lg z-20 uppercase tracking-wider">
                      {restaurant.offerTag}
                    </div>
                  )}

                  <div className="h-28 sm:h-36 relative bg-gray-100 overflow-hidden">
                    <div className="absolute inset-0 group-hover:scale-110 transition-transform duration-500">
                      {restaurant.image ? <img src={restaurant.image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-500 font-black text-3xl">{restaurant.name.charAt(0)}</div>}
                    </div>
                    {restaurant.rating && <span className="absolute bottom-2 left-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[10px] font-black shadow-sm z-10 flex gap-1 items-center">⭐ {restaurant.rating}</span>}
                    
                    {restaurant.isOpen ? (
                      <span className="absolute top-2 right-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[9px] font-black text-green-600 shadow-sm flex items-center gap-1 z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> LIVE
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[9px] font-black text-red-600 shadow-sm flex items-center gap-1 z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> CLOSED
                      </span>
                    )}
                  </div>
                  
                  <div className="p-4 flex-grow flex flex-col justify-between bg-white z-10">
                    <div>
                      <h4 className="text-sm sm:text-base font-black mb-1 text-gray-900 line-clamp-1">{restaurant.name}</h4>
                      <p className="text-orange-500 text-[9px] sm:text-[10px] font-black uppercase mb-2">🍽️ {restaurant.foodType || "Local Cuisine"}</p>
                      <p className="text-gray-500 text-[10px] sm:text-xs mb-3 flex items-center gap-1.5 font-bold truncate">📍 {restaurant.location || "Nepal"} {userLocation && restaurant.distance > 0 && <span className="text-orange-400 font-black ml-1">({restaurant.distance.toFixed(1)} km)</span>}</p>
                      
                      {restaurant.badgeText && (
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 text-orange-600 text-[9px] sm:text-[10px] font-black px-2 py-1.5 mb-3 rounded-lg border border-orange-200 inline-block w-full truncate shadow-sm">
                          {restaurant.badgeText}
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => handleRestaurantClick(restaurant._id)} 
                      className={`w-full font-black py-2.5 rounded-xl transition-all text-[10px] uppercase active:scale-95 mt-auto ${
                        restaurant.isOpen 
                          ? 'bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white' 
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {restaurant.isOpen ? 'View Menu ➔' : 'Currently Closed'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)}></div>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up relative">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <h2 className="text-xl font-black text-gray-900">Filters</h2>
              <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 font-black text-2xl p-1 relative z-10">✕</button>
            </div>
            <FilterSidebar />
            <button onClick={() => setIsFilterOpen(false)} className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl mt-8 shadow-lg uppercase active:scale-95">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
