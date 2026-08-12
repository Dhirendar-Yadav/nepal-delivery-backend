import { Bell, MapPin, Crown, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

function MobileNavbar({
    user,
    currentLocation,
    notificationCount,
    onShowCEOProfile,
}) {
    const navigate = useNavigate();

    return (
        <div className="md:hidden">
            <div className="flex items-center justify-between py-0.5">
                <div>
                    <h1
                        onClick={() => window.location.reload()}
                        className="text-lg font-black text-orange-600 leading-none cursor-pointer active:scale-95 transition"
                    >
                        Food Samundar
                    </h1>

                    <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-orange-500" />

                        <span className="text-[10px] text-gray-500">
                            Delivering to
                        </span>

                        <span className="text-[10px] font-semibold">
                            {currentLocation}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">

                    {/* 🔍 Search */}
                    <button
                        onClick={() => navigate("/search")}
                        className="transition active:scale-95"
                    >
                        <Search size={19} />
                    </button>

                    {/* 🔔 Notification */}
                    <button className="relative">
                        <Bell size={18} />

                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center">
                                {notificationCount}
                            </span>
                        )}
                    </button>

                    {/* 👑 CEO */}
                    <button
                        onClick={onShowCEOProfile}
                        className="flex flex-col items-center justify-center"
                    >
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <Crown
                                size={15}
                                className="text-orange-600"
                            />
                        </div>

                        <span className="text-[9px] font-semibold text-orange-600 mt-0.5">
                            CEO
                        </span>
                    </button>

                </div>
            </div>
        </div>
    );
}

export default MobileNavbar;