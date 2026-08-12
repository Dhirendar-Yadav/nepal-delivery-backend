import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { useUI } from './context/UIContext';
import { useLocation } from './context/LocationContext';
import CEOProfile from "./components/CEOProfile";
import FilterSidebar from "./components/FilterSidebar";
import RestaurantCard from "./components/RestaurantCard";
import SkeletonCard from "./components/SkeletonCard";
import EmptyState from "./components/EmptyState";
import DynamicIcons from "./components/DynamicIcons";
import MobileFilterModal from "./components/MobileFilterModal";
import useRestaurantFilters from "./hooks/useRestaurantFilters";
import { toggleSelection } from "./utils/filterUtils";
import useRestaurants from "./hooks/useRestaurants";
import useDynamicCategories from "./hooks/useDynamicCategories";
import useLocationPermission from "./hooks/useLocationPermission";
import {
    handleRestaurantClick,
    handleClearFilters,
} from "./helpers/homeHelpers";
import HeroSection from "./components/hero/HeroSection";
function Home() {
  const {
    restaurants,
    isLoading,
    apiError,
} = useRestaurants(); 
  const navigate = useNavigate(); 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSorts, setSelectedSorts] = useState([]); 
  const [isPureVeg, setIsPureVeg] = useState(false); 
  const [selectedCategories, setSelectedCategories] = useState([]); 
  const {
    showCEOProfile,
    setShowCEOProfile,
    isFilterOpen,
    setFilterOpen: setIsFilterOpen,
} = useUI();

const {
    location: userLocation,
    updateLocation,
    denyLocation,
} = useLocation();

  const sortOptions = [
    { id: 'Nearest', label: 'Nearest to Me' },
    { id: 'Rating', label: 'Top Rated' }
  ];

  useLocationPermission(updateLocation, denyLocation);
const {
    dynamicIcons,
    dynamicSidebarCategories,
} = useDynamicCategories(restaurants);
  // Processing Restaurants (Filters, Search, Distance, Mocks for UI)
  const processedRestaurants = useRestaurantFilters({
    restaurants,
    userLocation,
    searchQuery,
    selectedCategories,
    selectedSorts,
    isPureVeg
});
  // CEO Profile Section
  // CEO Profile Section
if (showCEOProfile) {
    return (
        <CEOProfile
            onClose={() => setShowCEOProfile(false)}
        />
    );
}
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 relative">
      {/* Top Navigation */}
    
      {/* Main Banner (Nepali Hook Kept Intact) */}
      <div className="sticky top-[72px] sm:top-[80px] z-50 px-3 py-2 bg-gray-50/90 backdrop-blur-md">
    <div className="max-w-5xl mx-auto bg-orange-500 rounded-2xl px-4 py-3 text-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <h2 className="text-lg sm:text-3xl font-black text-white leading-tight">
              भोक लाग्यो ? <span className="animate-bounce inline-block">🤤</span>
            </h2>
            <h3 className="text-sm sm:text-lg font-bold text-orange-100">
              अनि अर्डर गर्नुस् न हजुर ! <span className="animate-bounce inline-block ml-1">😉</span>
            </h3>
          </div>
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-8 mt-4">
        
        {/* Left Sidebar */}
        <div className="hidden md:block w-64 lg:w-72 shrink-0">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 sticky top-[230px]">
            <FilterSidebar
    searchQuery={searchQuery}
    setSearchQuery={setSearchQuery}
    sortOptions={sortOptions}
    selectedSorts={selectedSorts}
    setSelectedSorts={setSelectedSorts}
    toggleSelection={toggleSelection}
    isPureVeg={isPureVeg}
    setIsPureVeg={setIsPureVeg}
    dynamicSidebarCategories={dynamicSidebarCategories}
    selectedCategories={selectedCategories}
    setSelectedCategories={setSelectedCategories}
/>
          </div>
        </div>
        {/* Right Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <HeroSection
    userLocation={userLocation}
    searchQuery={searchQuery}
    setSearchQuery={setSearchQuery}
/>
          <div className="flex justify-between items-center mb-4">

    <div>

        <h2 className="text-lg md:text-2xl font-black text-gray-900">
            Nearby Restaurants
        </h2>

        <p className="text-xs md:text-sm text-gray-500">
            Showing restaurants near your location
        </p>

    </div>

    <span className="text-xs font-bold bg-orange-100 text-orange-600 px-3 py-1 rounded-full">
        {processedRestaurants.length}
    </span>

</div>
          
          {/* Short & Professional Empty State */}
          {!isLoading && apiError ? (
             <EmptyState
        icon="⚠️"
        title="Unable to Load Restaurants"
        message={apiError}
        buttonText="Retry"
        onButtonClick={() => window.location.reload()}
    />
) : !isLoading && processedRestaurants.length === 0 ? (
    <EmptyState
        icon="🍽️"
        title="Oops! No Matches Found"
        message={`We couldn't find any results for "${searchQuery}". Try searching for a different dish or restaurant.`}
        buttonText="Clear Filters"
        onButtonClick={() =>
    handleClearFilters(
        setSearchQuery,
        setSelectedCategories,
        setSelectedSorts,
        setIsPureVeg
    )
}
    />
) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {isLoading ? [...Array(12)].map((_, i) => <SkeletonCard key={i} />) : processedRestaurants.map((restaurant) => (
                <RestaurantCard
    key={restaurant._id}
    restaurant={restaurant}
    userLocation={userLocation}
    handleRestaurantClick={(id) =>
    handleRestaurantClick(id, navigate)
}
/>
              ))}
            </div>
          )}
        </div>
      </div>

      <MobileFilterModal
    isFilterOpen={isFilterOpen}
    setIsFilterOpen={setIsFilterOpen}
    searchQuery={searchQuery}
    setSearchQuery={setSearchQuery}
    sortOptions={sortOptions}
    selectedSorts={selectedSorts}
    setSelectedSorts={setSelectedSorts}
    toggleSelection={toggleSelection}
    isPureVeg={isPureVeg}
    setIsPureVeg={setIsPureVeg}
    dynamicSidebarCategories={dynamicSidebarCategories}
    selectedCategories={selectedCategories}
    setSelectedCategories={setSelectedCategories}
/>
    </div>
  );
}

export default Home;