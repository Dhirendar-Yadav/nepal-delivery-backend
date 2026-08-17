import { Link } from "react-router-dom";

function DesktopNavbar({

    onShowCEOProfile,

}) {
    return (
        <div className="hidden md:flex max-w-7xl mx-auto justify-between items-center relative">

            <div className="flex items-center gap-2">
                <h1
                    className="text-2xl sm:text-3xl font-black text-orange-600 tracking-tighter cursor-pointer"
                    onClick={() => (window.location.href = "/")}
                >
                    Food Samundar
                </h1>

                <span className="font-black text-[10px] sm:text-sm bg-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-inner ml-2 flex items-center gap-1.5 uppercase tracking-tight text-gray-700">
                    Nepal
                    <img
                        src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg"
                        alt="Nepal Flag"
                        className="w-5 h-auto ml-1"
                    />
                </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-6">

                <Link
                    to="/rider/signup"
                    className="text-[9px] sm:text-sm font-black text-gray-700 hover:text-orange-600 uppercase"
                >
                    Add Rider
                </Link>

                <Link
                    to="/seller/signup"
                    className="text-[9px] sm:text-sm font-black text-gray-700 hover:text-orange-600 uppercase"
                >
                    Add Pasal
                </Link>

                <Link
                    to="/login"
                    className="bg-gray-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-sm font-black hover:bg-orange-500 uppercase"
                >
                    Sign In
                </Link>

                <div
                    className="flex flex-col items-center gap-0.5 cursor-pointer group p-1"
                    onClick={onShowCEOProfile}
                >
                    <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gray-900 border-2 sm:border-4 border-white shadow-md group-hover:border-orange-500 transition-all flex items-center justify-center text-orange-500 font-black text-[10px] sm:text-lg">
                        D
                    </div>

                    <div className="flex flex-col items-center leading-none">
                        <p className="text-[8px] sm:text-[11px] font-black text-gray-900 uppercase">
                            Mr. Dhiru
                        </p>

                        <p className="text-[7px] sm:text-[9px] font-bold text-orange-600 bg-orange-50 px-1 py-0.5 rounded-full uppercase mt-0.5">
                            CEO
                        </p>
                    </div>
                </div>

            </div>

        </div>
    );
}

export default DesktopNavbar;
