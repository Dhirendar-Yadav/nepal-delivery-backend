import { Search } from "lucide-react";

function SearchBar({
    value,
    onChange,
    placeholder = "Search restaurants, food..."
}) {
    return (
        <div className="relative w-full">
            <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="
                    w-full
                    h-12
                    pl-11
                    pr-4
                    rounded-2xl
                    border
                    border-gray-200
                    bg-gray-50
                    focus:bg-white
                    focus:outline-none
                    focus:ring-2
                    focus:ring-orange-400
                    transition-all
                    text-sm
                "
            />
        </div>
    );
}

export default SearchBar;