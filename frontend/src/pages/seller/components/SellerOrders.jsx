function SellerOrders({
  orderSection,
  visibleOrders,
  openOrderDetail,
  rejectingOrderId,
  setRejectReasonType,
  setRejectReason,
  rejectReasonType,
  rejectReason,
  setRejectingOrderId,
  updateOrderStatus
}) {
  return (
    <>
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-white sm:text-2xl">
              {orderSection === 'new'
                ? 'New Orders'
                : orderSection === 'preparing'
                  ? 'Rider Assigned / Preparing'
                  : orderSection === 'ready'
                    ? 'Ready for Pickup'
                    : orderSection === 'out'
                      ? 'Out for Delivery'
                      : orderSection === 'history'
                        ? 'Order History'
                        : 'Orders'}
            </h2>
          </div>

          <span className="shrink-0 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400 ring-1 ring-orange-500/20 sm:px-4 sm:py-2 sm:text-sm">
            {visibleOrders.length}
          </span>
        </div>

        {!orderSection ? (
          <div className="rounded-2xl border border-gray-700 bg-gray-800/50 px-4 py-5 text-sm font-medium text-gray-500">
            Open <span className="font-bold text-gray-300">Live Orders</span> from the seller menu and choose the order section you want to manage.
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-gray-700 bg-gray-800/50 px-4 py-8 text-center">
            <h3 className="text-sm font-black text-gray-400 sm:text-base">
              {orderSection === 'new'
                ? 'No New Orders'
                : orderSection === 'preparing'
                  ? 'No Assigned Orders'
                  : orderSection === 'ready'
                    ? 'No Pickup Orders'
                    : orderSection === 'out'
                      ? 'No Delivery Orders'
                      : 'No Order History'}
            </h3>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <div className="w-full max-w-[720px]">
              <div className="grid w-full grid-cols-[34px_minmax(38px,0.8fr)_minmax(64px,1.25fr)_minmax(72px,1.2fr)_minmax(54px,0.9fr)_minmax(72px,1fr)] items-center border-b border-gray-700 px-0.5 py-1 text-[7px] font-black uppercase tracking-wide text-gray-500 sm:grid-cols-[42px_minmax(48px,0.8fr)_minmax(92px,1.25fr)_minmax(104px,1.2fr)_minmax(68px,0.9fr)_minmax(82px,1fr)] sm:px-1 sm:py-1.5 sm:text-[9px]">
                <span>S.N.</span>
                <span>Order</span>
                <span>Name</span>
                <span>Phone</span>
                <span>Status</span>
                <span>Action</span>
              </div>

              <div className="divide-y divide-gray-700/80">
                {visibleOrders.map((order, index) => (
                  <div
                    key={order._id}
                    className="grid w-full grid-cols-[34px_minmax(38px,0.8fr)_minmax(64px,1.25fr)_minmax(72px,1.2fr)_minmax(54px,0.9fr)_minmax(72px,1fr)] items-center px-0.5 py-1.5 transition hover:bg-gray-800 sm:grid-cols-[42px_minmax(48px,0.8fr)_minmax(92px,1.25fr)_minmax(104px,1.2fr)_minmax(68px,0.9fr)_minmax(82px,1fr)] sm:px-1 sm:py-2"
                  >
                    <span className="text-[8px] font-black text-gray-400 sm:text-xs">
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => openOrderDetail(order._id)}
                      className="min-w-0 truncate text-left text-[8px] font-black text-gray-300 transition hover:text-white sm:text-xs"
                    >
                      #{order._id.substring(order._id.length - 6)}
                    </button>

                    <p className="min-w-0 truncate text-[8px] font-black text-white sm:text-xs">
                      {order.customerId?.name || 'Guest'}
                    </p>

                    <p className="min-w-0 truncate text-[8px] font-semibold text-gray-300 sm:text-xs">
                      {order.customerId?.phone || order.deliveryDetails?.phone || 'Phone unavailable'}
                    </p>

                    <p
                      className={`min-w-0 truncate text-[7px] font-black uppercase sm:text-[10px] ${
                        order.status === 'Pending'
                          ? 'text-red-400'
                          : order.status === 'Accepted'
                            ? 'text-amber-400'
                            : order.status === 'Preparing'
                              ? 'text-orange-400'
                              : order.status === 'Ready for Pickup'
                                ? 'text-green-400'
                                : order.status === 'Out for Delivery'
                                  ? 'text-blue-400'
                                  : order.status === 'Delivered'
                                    ? 'text-emerald-400'
                                    : 'text-gray-400'
                      }`}
                    >
                      {order.status}
                    </p>

                    <button
                      type="button"
                      onClick={() => openOrderDetail(order._id)}
                      className="whitespace-nowrap text-left text-[8px] font-black text-orange-400 transition hover:text-orange-300 active:scale-95 sm:text-[10px]"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {rejectingOrderId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
            <div className="mb-6">
              <h3 className="text-2xl font-black text-white">
                Reject Order
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                Select the reason for rejecting this order.
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Food unavailable",
                "Item out of stock",
                "Restaurant too busy",
                "Restaurant temporarily unavailable"
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setRejectReasonType(reason);
                    setRejectReason(reason);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left font-bold transition ${
                    rejectReasonType === reason
                      ? "border-red-500 bg-red-500/10 text-red-400"
                      : "border-gray-700 bg-gray-900 text-gray-300 hover:border-red-500/50"
                  }`}
                >
                  {reason}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setRejectReasonType("Other");
                  setRejectReason("");
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left font-bold transition ${
                  rejectReasonType === "Other"
                    ? "border-red-500 bg-red-500/10 text-red-400"
                    : "border-gray-700 bg-gray-900 text-gray-300 hover:border-red-500/50"
                }`}
              >
                Other
              </button>
            </div>

            {rejectReasonType === "Other" && (
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                maxLength={300}
                className="mt-4 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-red-500"
                placeholder="Enter the reason for rejecting this order..."
              />
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectReason("");
                  setRejectReasonType("");
                }}
                className="rounded-xl bg-gray-700 px-5 py-3 font-black text-white transition hover:bg-gray-600"
              >
                Close
              </button>

              <button
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => updateOrderStatus(rejectingOrderId, 'Cancelled', rejectReason)}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SellerOrders;
