function DynamicIcons({
    dynamicIcons,
    selectedCategories,
    toggleSelection,
    setSelectedCategories,
}) {
    if (!dynamicIcons.length) return null;

    return (
        <div className="mb-8">
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">
                What are you craving?
            </h3>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {dynamicIcons.map((item) => (
                    <button
                        key={item.name}
                        onClick={() =>
                            toggleSelection(item.keyword, setSelectedCategories)
                        }
                        className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] p-3 rounded-2xl transition-all ${
                            selectedCategories.includes(item.keyword)
                                ? "bg-orange-100 border-2 border-orange-500 shadow-md scale-105"
                                : "bg-white border border-gray-100 shadow-sm hover:shadow-md hover:bg-orange-50"
                        }`}
                    >
                        <span className="text-3xl mb-1">{item.icon}</span>

                        <span
                            className={`text-[10px] font-black uppercase ${
                                selectedCategories.includes(item.keyword)
                                    ? "text-orange-600"
                                    : "text-gray-600"
                            }`}
                        >
                            {item.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default DynamicIcons;