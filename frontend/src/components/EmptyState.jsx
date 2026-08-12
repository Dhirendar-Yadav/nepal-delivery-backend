function EmptyState({
    icon,
    title,
    message,
    buttonText,
    onButtonClick,
}) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
            <div className="text-6xl mb-4 grayscale opacity-50">
                {icon}
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2">
                {title}
            </h3>

            <p className="text-gray-500 font-bold max-w-md">
                {message}
            </p>

            <button
                onClick={onButtonClick}
                className="mt-6 bg-orange-50 text-orange-600 font-black px-8 py-3 rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-sm uppercase text-xs tracking-wider"
            >
                {buttonText}
            </button>
        </div>
    );
}

export default EmptyState;