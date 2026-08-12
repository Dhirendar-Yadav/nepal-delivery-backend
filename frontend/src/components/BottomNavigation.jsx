import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function BottomNavigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const menus = [
        {
            label: "Home",
            path: "/",
            icon: "🏠",
        },
        {
            label: "Search",
            path: "/search",
            icon: "🔍",
        },
        {
            label: "Orders",
            path: "/orders",
            icon: "📦",
        },
        {
            label: "Profile",
            path: "/profile",
            icon: "👤",
        },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="grid grid-cols-4 h-16">
                {menus.map((item) => (
                    <Link
                        key={item.path}
                        to="#"
                        onClick={(e) => {
                            e.preventDefault();

                            // Profile Protection
                            if (item.label === "Profile") {
                                if (isAuthenticated) {
                                    navigate("/profile");
                                } else {
                                    navigate("/login");
                                }
                                return;
                            }

                            // Orders Protection
                            if (item.label === "Orders") {
                                if (isAuthenticated) {
                                    navigate("/orders");
                                } else {
                                    navigate("/login");
                                }
                                return;
                            }

                            // Normal Navigation
                            navigate(item.path);
                        }}
                        className={`flex flex-col items-center justify-center transition-all ${
                            location.pathname === item.path
                                ? "text-orange-500 font-bold"
                                : "text-gray-500"
                        }`}
                    >
                        <span className="text-xl">{item.icon}</span>

                        <span className="text-[10px]">
                            {item.label}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default BottomNavigation;