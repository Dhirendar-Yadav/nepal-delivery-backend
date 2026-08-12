function CEOProfile({ onClose }) {
    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-y-auto">

            <div className="w-full max-w-7xl mx-auto min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 relative">

                <button
                    onClick={onClose}
                    className="absolute top-8 left-8 text-gray-400 hover:text-orange-500 font-black text-xs sm:text-sm uppercase tracking-[0.2em] transition-all z-20 active:scale-95"
                >
                    Back
                </button>

                <div className="relative mb-12 mt-16 md:mt-0">

                    <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gray-900 border-[8px] border-white shadow-2xl flex items-center justify-center text-orange-500 font-black text-6xl sm:text-7xl overflow-hidden">

                        D

                    </div>

                </div>

                <h2 className="text-3xl sm:text-5xl font-black text-gray-900 uppercase tracking-tighter text-center">
                    Mr. Dhiru Yadav
                </h2>

                <div className="flex items-center justify-center gap-2 mt-3 mb-10 bg-gray-100 px-5 py-2 rounded-full border border-gray-200 shadow-inner">

                    <span className="text-gray-700 font-black text-xs sm:text-sm uppercase">
                        Nepal
                    </span>

                    <img
                        src="https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/np.svg"
                        className="w-6 h-auto"
                        alt="Nepal"
                    />

                </div>

                <p className="text-[10px] sm:text-[12px] font-black text-orange-500 uppercase tracking-[0.5em] mb-12 border-b-2 border-orange-500 pb-1">
                    CEO & Founder
                </p>

                <div className="space-y-6 max-w-4xl text-center">

                    <h3 className="text-2xl sm:text-4xl font-black text-gray-800 italic leading-tight">

                        "हाम्रो सेवा, तपाईँको सन्तुष्टि"

                    </h3>

                    <div className="h-1.5 w-32 bg-orange-500 mx-auto rounded-full"></div>

                    <p className="text-gray-400 font-bold text-xs sm:text-sm uppercase tracking-widest pt-6 border-t border-gray-100">

                        Food Samundar Delivery Services Pvt. Ltd.

                    </p>

                </div>

            </div>

        </div>
    );
}

export default CEOProfile;