import React from "react";

function RestaurantCard({
    restaurant,
    userLocation,
    handleRestaurantClick,
}) {
    return (
        <div
            className={`bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all border border-gray-100 flex flex-col overflow-hidden group active:scale-95 relative ${
                restaurant.isOpen === false
                    ? "opacity-80 grayscale-[40%]"
                    : ""
            }`}
        >
            <div className="h-20 sm:h-28 relative bg-gray-100 overflow-hidden">
                <div className="absolute inset-0 group-hover:scale-110 transition-transform duration-500">
                    {restaurant.image ? (
                        <img
                            src={restaurant.image}
                            alt={restaurant.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-500 font-black text-3xl">
                            {restaurant.name.charAt(0)}
                        </div>
                    )}
                </div>

                {restaurant.rating && (
                    <span className="absolute bottom-2 left-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[9px] font-black shadow-sm z-10 flex gap-1 items-center">
                        ⭐ {restaurant.rating}
                    </span>
                )}

                {restaurant.isOpen === true ? (
                    <span className="absolute top-2 right-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[9px] font-black text-green-600 shadow-sm flex items-center gap-1 z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        LIVE
                    </span>
                ) : restaurant.isOpen === false ? (
                    <span className="absolute top-2 right-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[9px] font-black text-red-600 shadow-sm flex items-center gap-1 z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        CLOSED
                    </span>
                ) : (
                    <span className="absolute top-2 right-2 bg-white/90 px-1.5 py-0.5 rounded-lg text-[9px] font-black text-gray-600 shadow-sm z-10">
                        STATUS UNKNOWN
                    </span>
                )}
            </div>

            <div className="p-2.5 flex-grow flex flex-col justify-between bg-white">
                <div>
                    <h4 className="text-xs sm:text-sm font-black mb-1 text-gray-900 line-clamp-1">
                        {restaurant.name}
                    </h4>
                    <p className="text-gray-500 text-[10px] sm:text-xs mb-3 flex items-center gap-1.5 font-bold truncate">
                        📍 {restaurant.location || "Nepal"}

                        {userLocation &&
                            restaurant.distance > 0 && (
                                <span className="text-orange-400 font-black ml-1">
                                    ({restaurant.distance.toFixed(1)} km)
                                </span>
                            )}
                    </p>
                </div>

                <button
                    onClick={() =>
                        restaurant.isOpen !== false &&
                        handleRestaurantClick(restaurant._id)
                    }
                    className={`w-full font-black py-1.5 rounded-xl transition-all text-[10px] uppercase active:scale-95 mt-auto ${
                        restaurant.isOpen !== false
                            ? "bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                >
                    {restaurant.isOpen === false
                        ? "Currently Closed"
                        : "View Menu ➔"}
                </button>
            </div>
        </div>
    );
}

export default RestaurantCard;