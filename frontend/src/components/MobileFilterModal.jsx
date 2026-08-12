import FilterSidebar from "./FilterSidebar";

function MobileFilterModal({
    isFilterOpen,
    setIsFilterOpen,
    searchQuery,
    setSearchQuery,
    sortOptions,
    selectedSorts,
    setSelectedSorts,
    toggleSelection,
    isPureVeg,
    setIsPureVeg,
    dynamicSidebarCategories,
    selectedCategories,
    setSelectedCategories,
}) {
    if (!isFilterOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] md:hidden">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsFilterOpen(false)}
            />

            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up relative">

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <h2 className="text-xl font-black text-gray-900">
                        Filters
                    </h2>

                    <button
                        onClick={() => setIsFilterOpen(false)}
                        className="text-gray-400 font-black text-2xl p-1 relative z-10"
                    >
                        ✕
                    </button>
                </div>

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

                <button
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl mt-8 shadow-lg uppercase active:scale-95"
                >
                    Apply
                </button>

            </div>
        </div>
    );
}

export default MobileFilterModal;