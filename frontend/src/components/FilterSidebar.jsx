function FilterSidebar({
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
    return (
        <div className="space-y-6">

            <div className="relative mb-6">
                <input
                    type="text"
                    placeholder="Search momo, pizza..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none font-bold text-gray-800 text-sm shadow-inner"
                />
            </div>

            <div>
                <h3 className="font-black text-gray-900 mb-3 uppercase tracking-widest text-[10px]">
                    Sort By
                </h3>

                <div className="flex flex-col gap-3">
                    {sortOptions.map((opt) => (
                        <label
                            key={opt.id}
                            className="flex items-center gap-3 cursor-pointer group"
                        >
                            <input
                                type="checkbox"
                                checked={selectedSorts.includes(opt.id)}
                                onChange={() =>
                                    toggleSelection(opt.id, setSelectedSorts)
                                }
                                className="w-4 h-4 accent-orange-500 rounded"
                            />

                            <span className="text-sm font-bold text-gray-600 group-hover:text-orange-500">
                                {opt.label}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <hr className="border-gray-100" />

            <label className="flex items-center gap-3 cursor-pointer group">
                <input
                    type="checkbox"
                    checked={isPureVeg}
                    onChange={(e) => setIsPureVeg(e.target.checked)}
                    className="w-4 h-4 accent-green-600 rounded"
                />

                <span className="text-sm font-bold text-green-700">
                    Pure Veg 🌱
                </span>
            </label>

            <hr className="border-gray-100" />

            <div>
                <h3 className="font-black text-gray-900 mb-3 uppercase tracking-widest text-[10px]">
                    Cuisines
                </h3>

                <div className="grid grid-cols-1 gap-3">
                    {dynamicSidebarCategories.length > 0 ? (
                        dynamicSidebarCategories.map((cat) => (
                            <label
                                key={cat}
                                className="flex items-center gap-3 cursor-pointer group"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(cat)}
                                    onChange={() =>
                                        toggleSelection(
                                            cat,
                                            setSelectedCategories
                                        )
                                    }
                                    className="w-4 h-4 accent-orange-500 rounded"
                                />

                                <span className="text-sm font-bold text-gray-600 group-hover:text-orange-500">
                                    {cat}
                                </span>
                            </label>
                        ))
                    ) : (
                        <span className="text-xs text-gray-400 italic">
                            No categories found
                        </span>
                    )}
                </div>
            </div>

        </div>
    );
}

export default FilterSidebar;