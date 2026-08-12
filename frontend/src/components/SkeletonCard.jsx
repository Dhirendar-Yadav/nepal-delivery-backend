function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
            <div className="h-28 sm:h-32 bg-gray-200 w-full"></div>

            <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>

                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
        </div>
    );
}

export default SkeletonCard;