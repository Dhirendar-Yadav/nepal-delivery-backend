import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // ✨ ADDED useNavigate

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

function Menu() {
  const { id } = useParams(); 
  const navigate = useNavigate(); // ✨ INITIALIZED navigate
  const [menuItems, setMenuItems] = useState([]);
  const [restaurantName, setRestaurantName] = useState(""); 
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const fetchMenuAndDetails = async () => {
      setApiError('');
      let menuLoaded = false;
      try {
        const menuRes = await fetch(`${API_BASE}/api/menu/${id}`);
        if (menuRes.ok) {
          const menuData = await menuRes.json();
          setApiError('');
          setMenuItems(menuData);
          menuLoaded = true;
        } else {
          setApiError('Unable to Load Menu');
        }

        const restRes = await fetch(`${API_BASE}/api/restaurants`);
        if (restRes.ok) {
          const restData = await restRes.json();
          const currentRest = restData.find(r => r._id === id);
          if (currentRest) setRestaurantName(currentRest.name);
        }
      } catch (error) {
        console.error("API Error:", error);
        if (!menuLoaded) setApiError('Unable to Load Menu');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenuAndDetails();
  }, [id]);

  const addToCart = (item) => setCart([...cart, item]);
  const removeFromCart = (indexToRemove) => setCart(cart.filter((_, index) => index !== indexToRemove));
  const totalAmount = cart.reduce((total, item) => total + item.price, 0);

  // ✨ THE FIX: Proper navigation function with data transfer
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("Please add at least one item to your cart before checkout!");
      return;
    }
    // Ye line tujhe Checkout page pe bhejegi aur cart ka data sath le jayegi
    navigate('/checkout', { state: { cartItems: cart, restaurantId: id, totalAmount } });
  };

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] font-sans text-gray-900 m-0 p-0 overflow-x-hidden">
      
      {/* 🧭 Navbar */}
      <nav className="w-full bg-white/70 backdrop-blur-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="bg-gray-100 hover:bg-orange-500 hover:text-white px-4 py-2 rounded-2xl font-bold transition-all duration-300">
            ⬅ Back
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-[3px]">Ordering From</p>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-none">{restaurantName || "Food Samundar"}</h1>
          </div>
          <div className="bg-orange-500 text-white px-5 py-2 rounded-2xl font-black shadow-lg shadow-orange-100">
            🛒 {cart.length}
          </div>
        </div>
      </nav>

      {/* 🍱 Main Grid Layout */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* 🥘 Left Side: Menu Cards */}
          <div className="w-full lg:w-2/3">
            <div className="mb-10">
              <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Menu</h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : apiError ? (
              <div className="text-center py-20">
                <p className="text-gray-500 font-bold">{apiError}</p>
              </div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 font-bold">No Menu Items Found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {menuItems.map((item) => (
                  <div key={item._id} className="bg-white rounded-[2.5rem] p-8 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] border border-gray-50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/50 rounded-bl-[5rem] -mr-16 -mt-16 group-hover:bg-orange-500/10 transition-colors"></div>
                    <span className="bg-green-100 text-green-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter">{item.foodCategory || 'Not Specified'}</span>
                    
                    <h3 className="text-2xl font-black text-gray-800 mt-6 group-hover:text-orange-600 transition-colors">{item.name}</h3>
                    <p className="text-gray-400 text-sm mt-3 leading-relaxed min-h-[50px]">
                      {item.description || "Freshly cooked and packed with authentic Nepali spices and lots of love."}
                    </p>
                    
                    <div className="flex justify-between items-center mt-10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Price</span>
                        <p className="text-2xl font-black text-gray-900">Rs. {item.price}</p>
                      </div>
                      <button 
                        onClick={() => addToCart(item)}
                        className="bg-gray-900 hover:bg-orange-500 text-white font-black py-4 px-10 rounded-3xl shadow-xl active:scale-90 transition-all"
                      >
                        ADD +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🛍️ Right Side: The Master Cart */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white rounded-[3rem] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.1)] border border-gray-50 sticky top-32">
              <h3 className="text-2xl font-black mb-8 text-gray-900 flex justify-between items-center">
                Your Jhola 🧺
                <span className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-400 font-bold">{cart.length} Items</span>
              </h3>
              
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-6 opacity-10 grayscale">🥘</div>
                  <p className="text-gray-400 font-bold italic tracking-wide">Basket is empty!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-10 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {cart.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50/50 p-4 rounded-3xl border border-gray-100 hover:bg-white transition-colors">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-800 text-sm leading-tight">{item.name}</span>
                          <span className="text-xs font-bold text-orange-500 mt-1">NPR {item.price}</span>
                        </div>
                        <button 
                          onClick={() => removeFromCart(index)}
                          className="bg-red-50 text-red-400 hover:bg-red-500 hover:text-white w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t-4 border-double border-gray-100 pt-8 mt-6">
                    <div className="flex justify-between items-end mb-10">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-300 uppercase">Subtotal Amount</span>
                        <span className="text-4xl font-black text-gray-900 tracking-tighter">Rs. {totalAmount}</span>
                      </div>
                    </div>

                    {/* ✨ UPDATED BUTTON */}
                    <button 
                      onClick={handleCheckout} 
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-6 rounded-[2rem] shadow-[0_20px_40px_rgba(249,115,22,0.3)] transition-all active:scale-95 text-xl tracking-widest uppercase"
                    >
                      Checkout Now ➔
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Menu;
