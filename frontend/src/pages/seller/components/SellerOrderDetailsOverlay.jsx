function SellerOrderDetailsOverlay({ order, onClose, onAccept, onReject }) {
  if (!order) {
    return null;
  }

  const formatPaisa = (value) =>
    `NPR ${((Number(value) || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const customerId = order.customerId?._id || order.customerId || "N/A";

  const customerName = order.customerId?.name || "Guest";

  const customerPhone =
    order.customerId?.phone || order.deliveryDetails?.phone || "N/A";

  const isPending = order.status === "Pending";

  return (
    <div
      className="fixed inset-0 z-[102] flex items-start justify-center overflow-y-auto bg-black/65 px-3 pb-4 pt-20 backdrop-blur-md sm:px-5 sm:pb-5 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Order details"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-y-auto overflow-x-hidden rounded-3xl border border-gray-700/80 bg-gray-900/95 p-4 shadow-2xl backdrop-blur-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-700/80 pb-3 sm:pb-4">
          <h2 className="text-base font-black uppercase tracking-wide text-orange-500 sm:text-xl">
            Order Details
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-[10px] sm:grid-cols-2 sm:gap-y-3 sm:text-xs">
          <div className="min-w-0">
            <span className="font-bold text-gray-500">Order ID :</span>{" "}
            <span className="font-black text-gray-200">
              {order._id || "N/A"}
            </span>
          </div>

          <div className="min-w-0">
            <span className="font-bold text-gray-500">Customer ID :</span>{" "}
            <span className="font-black text-gray-200">{customerId}</span>
          </div>

          <div className="min-w-0">
            <span className="font-bold text-gray-500">Customer :</span>{" "}
            <span className="font-black text-white">{customerName}</span>
          </div>

          <div className="min-w-0">
            <span className="font-bold text-gray-500">Phone :</span>{" "}
            <span className="font-black text-gray-200">{customerPhone}</span>
          </div>
        </div>

        <section className="mt-4 sm:mt-5">
          <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500 sm:text-[10px]">
            Delivery Address
          </h3>

          <div className="mt-1.5 rounded-2xl border border-gray-700/70 bg-gray-800/70 px-3 py-2.5 text-[10px] font-bold leading-relaxed text-gray-200 sm:mt-2 sm:px-4 sm:py-3 sm:text-xs">
            {(() => {
              const rawAddress = String(order.deliveryDetails?.address || "")
                .split(",")
                .map((part) => part.replace(/\s+/g, " ").trim())
                .filter(Boolean);

              const englishParts = rawAddress.filter(
                (part) => !/[^\p{ASCII}]/u.test(part),
              );

              const preferredParts =
                englishParts.length > 0 ? englishParts : rawAddress;

              const uniqueParts = preferredParts.filter(
                (part, index, parts) =>
                  parts.findIndex(
                    (item) =>
                      item.toLocaleLowerCase("en") ===
                      part.toLocaleLowerCase("en"),
                  ) === index,
              );

              return (
                uniqueParts.slice(0, 2).join(", ") || "Address not available"
              );
            })()}
          </div>
        </section>

        <section className="mt-4 sm:mt-5">
          <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500 sm:text-[10px]">
            Items
          </h3>

          <div className="mt-1.5 space-y-1.5 sm:mt-2 sm:space-y-2">
            {Array.isArray(order.items) && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <div
                  key={item.menuItemId || `${item.name}-${index}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl bg-gray-800/60 px-3 py-2 text-[10px] sm:text-xs"
                >
                  <span className="min-w-0 truncate font-black text-gray-200">
                    {item.name || "Item"}
                  </span>

                  <span className="whitespace-nowrap font-bold text-gray-400">
                    ×{item.quantity || 0}
                  </span>

                  <span className="whitespace-nowrap font-black text-white">
                    {formatPaisa(
                      (Number(item.price) || 0) * (Number(item.quantity) || 0),
                    )}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-gray-800/60 px-3 py-2.5 text-[10px] font-bold text-gray-500 sm:text-xs">
                No item details available.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 border-t border-gray-700/80 pt-3 sm:mt-5 sm:pt-4">
          <div className="grid grid-cols-2 gap-3 text-[9px] sm:grid-cols-4 sm:text-xs">
            <div className="min-w-0">
              <p className="text-gray-500">Food</p>
              <p className="mt-0.5 truncate font-black text-gray-200">
                {formatPaisa(order.foodCost)}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-gray-500">Delivery</p>
              <p className="mt-0.5 truncate font-black text-gray-200">
                {formatPaisa(order.deliveryFee)}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-gray-500">Discount</p>
              <p className="mt-0.5 truncate font-black text-gray-200">
                -{formatPaisa(order.discountAmount)}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-gray-500">Tax</p>
              <p className="mt-0.5 truncate font-black text-gray-200">
                {formatPaisa(order.taxAmount)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-orange-500/10 px-3 py-2.5 ring-1 ring-orange-500/20 sm:mt-4 sm:px-4 sm:py-3">
            <span className="text-[10px] font-black uppercase tracking-wide text-orange-400 sm:text-xs">
              Total
            </span>

            <span className="text-sm font-black text-white sm:text-lg">
              {formatPaisa(order.totalAmount)}
            </span>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-2 text-[9px] sm:mt-5 sm:grid-cols-2 sm:text-xs">
          <div className="min-w-0 rounded-xl bg-gray-800/60 px-2.5 py-2 sm:px-3">
            <span className="font-bold text-gray-500">Payment :</span>{" "}
            <span className="font-black text-gray-200">
              {order.paymentMethod || "N/A"}
            </span>
          </div>

          <div className="min-w-0 rounded-xl bg-gray-800/60 px-2.5 py-2 sm:px-3">
            <span className="font-bold text-gray-500">Status :</span>{" "}
            <span className="font-black text-gray-200">
              {order.paymentStatus || "PENDING"}
            </span>
          </div>
        </section>

        <div className="mt-3 text-[9px] text-gray-400 sm:text-xs">
          <span className="font-bold text-gray-500">Order Time :</span>{" "}
          <span className="font-black text-gray-300">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleString("en-IN")
              : "N/A"}
          </span>
        </div>

        {!isPending && order.status === "Cancelled" && (
          <section className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 sm:mt-5 sm:px-4 sm:py-3">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-red-400 sm:text-[10px]">
              Cancellation Reason
            </h3>

            <p className="mt-1 text-[10px] font-bold leading-relaxed text-gray-300 sm:text-xs">
              {order.cancellationReason || "No cancellation reason available"}
            </p>
          </section>
        )}

        {isPending && (
          <div className="mt-4 flex justify-end gap-2 border-t border-gray-700/80 pt-3 sm:mt-5 sm:pt-4">
            <button
              type="button"
              onClick={onReject}
              className="rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black text-white transition hover:bg-red-500 active:scale-95 sm:px-5 sm:py-3 sm:text-sm"
            >
              Reject
            </button>

            <button
              type="button"
              onClick={onAccept}
              className="rounded-xl bg-green-600 px-3 py-2 text-[10px] font-black text-white transition hover:bg-green-500 active:scale-95 sm:px-5 sm:py-3 sm:text-sm"
            >
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SellerOrderDetailsOverlay;
