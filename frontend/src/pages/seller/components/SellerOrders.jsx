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
  updateOrderStatus,
}) {
  return (
    <>
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-white sm:text-2xl">
              {orderSection === "new"
                ? "New Orders"
                : orderSection === "preparing"
                  ? "Rider Assigned / Preparing"
                  : orderSection === "ready"
                    ? "Ready for Pickup"
                    : orderSection === "out"
                      ? "Out for Delivery"
                      : orderSection === "history"
                        ? "Order History"
                        : "Orders"}
            </h2>
          </div>

          <span className="shrink-0 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400 ring-1 ring-orange-500/20 sm:px-4 sm:py-2 sm:text-sm">
            {visibleOrders.length}
          </span>
        </div>
        <div className="w-full">
          <div className="w-full overflow-hidden">
            <table
              className={`w-fit border-collapse text-left ${
                orderSection === "new" ? "md:min-w-[640px]" : ""
              }`}
            >
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="whitespace-nowrap px-2 py-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    S.N.
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    Order id
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    Customer
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    View
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-700/80">
                {visibleOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-5 text-center text-xs font-black text-gray-500"
                    >
                      {orderSection === "new"
                        ? "No New Orders"
                        : orderSection === "preparing"
                          ? "No Assigned Orders"
                          : orderSection === "ready"
                            ? "No Pickup Orders"
                            : orderSection === "out"
                              ? "No Delivery Orders"
                              : "No Order History"}
                    </td>
                  </tr>
                ) : (
                  visibleOrders.map((order, index) => (
                    <tr
                      key={order._id}
                      className="transition hover:bg-gray-800"
                    >
                      <td className="whitespace-nowrap px-2 py-2 text-sm font-black text-gray-400">
                        {index + 1}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2 text-sm font-black text-gray-300">
                        {order._id}
                      </td>

                      <td className="w-[1%] max-w-[160px] px-2 py-2 text-sm font-black text-white">
                        <span className="block max-w-[160px] truncate">
                          {order.customerId?.name || "Guest"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {order.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateOrderStatus(order._id, "Accepted")
                                }
                                className="rounded-lg bg-green-600 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-green-500 active:scale-95"
                              >
                                Accept
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingOrderId(order._id);
                                  setRejectReasonType("");
                                  setRejectReason("");
                                }}
                                className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-red-500 active:scale-95"
                              >
                                Reject
                              </button>
                            </>
                          ) : order.status === "Preparing" ? (
                            <span className="whitespace-nowrap text-[10px] font-black text-orange-400">
                              Preparing
                            </span>
                          ) : order.status === "Accepted" ? (
                            <span className="whitespace-nowrap text-[10px] font-black text-amber-400">
                              Waiting for Rider
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-gray-500"></span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => openOrderDetail(order._id)}
                          className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-orange-400 active:scale-95"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {rejectingOrderId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
            <div className="mb-6">
              <h3 className="text-2xl font-black text-white">Reject Order</h3>
              <p className="mt-2 text-sm text-gray-400">
                Select the reason for rejecting this order.
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Food unavailable",
                "Item out of stock",
                "Restaurant too busy",
                "Restaurant temporarily unavailable",
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
                onClick={() =>
                  updateOrderStatus(rejectingOrderId, "Cancelled", rejectReason)
                }
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
