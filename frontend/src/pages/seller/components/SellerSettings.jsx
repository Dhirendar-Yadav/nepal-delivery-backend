function SellerSettings({
  restaurant,
  updatingStoreStatus,
  toggleStoreStatus
}) {
  return (
    <>
      <section className="space-y-8">
              <div>
                <h2 className="text-2xl font-black text-white sm:text-3xl">
                  Settings
                </h2>

                <div className="mt-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">
                    Restaurant
                  </h3>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-gray-300 sm:text-base">
                      Restaurant is currently {restaurant?.isOpen ? 'open' : 'closed'}
                    </p>

                    <button
                      type="button"
                      aria-label={
                        restaurant?.isOpen
                          ? "Tap to close restaurant"
                          : "Tap to open restaurant"
                      }
                      disabled={updatingStoreStatus}
                      onClick={toggleStoreStatus}
                      className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black tracking-wide transition-all duration-200 active:scale-95 ${
                        restaurant?.isOpen
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-red-500 text-white hover:bg-red-600"
                      } ${
                        updatingStoreStatus
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      {updatingStoreStatus
                        ? "Updating"
                        : restaurant?.isOpen
                        ? "Tap to close"
                        : "Tap to open"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
  );
}

export default SellerSettings;
