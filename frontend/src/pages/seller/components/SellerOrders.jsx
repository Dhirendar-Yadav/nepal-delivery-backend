import { useEffect, useState } from "react";
import SellerOrderDetailsOverlay from "./SellerOrderDetailsOverlay";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5005";

function SellerOrders({
  orderSection,
  visibleOrders,
  openOrderDetail,
  selectedOrder,
  closeOrderDetail,
  rejectingOrderId,
  setRejectReasonType,
  setRejectReason,
  rejectReasonType,
  rejectReason,
  setRejectingOrderId,
  updateOrderStatus,
}) {
  const [pickupOrder, setPickupOrder] = useState(null);
  const [pickupOtp, setPickupOtp] = useState("");
  const [pickupOtpExpiresAt, setPickupOtpExpiresAt] = useState(null);
  const [pickupOtpIssuedAt, setPickupOtpIssuedAt] = useState(null);
  const [pickupOtpError, setPickupOtpError] = useState("");
  const [pickupOtpMessage, setPickupOtpMessage] = useState("");
  const [pickupOtpLoading, setPickupOtpLoading] = useState(false);
  const [pickupOtpSeconds, setPickupOtpSeconds] = useState(0);

  useEffect(() => {
    if (!pickupOtpExpiresAt) {
      return undefined;
    }

    const updateCountdown = () => {
      setPickupOtpSeconds(Math.max(0, Math.ceil((new Date(pickupOtpExpiresAt).getTime() - Date.now()) / 1000)));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [pickupOtpExpiresAt]);

  const sendPickupOtp = async () => {
    if (!pickupOrder?._id) return;
    setPickupOtpLoading(true);
    setPickupOtpError("");
    setPickupOtpMessage("");

    try {
      const res = await fetch(`${API_BASE}/api/seller/orders/${pickupOrder._id}/pickup-otp`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setPickupOtpError(data.message || "Failed to send OTP.");
        return;
      }
      setPickupOtpExpiresAt(data.expiresAt);
      setPickupOtpIssuedAt(data.issuedAt);
      setPickupOtpMessage("OTP sent to the assigned rider.");
    } catch {
      setPickupOtpError("Failed to send OTP.");
    } finally {
      setPickupOtpLoading(false);
    }
  };

  const verifyPickupOtp = async () => {
    if (!pickupOrder?._id) return;
    setPickupOtpLoading(true);
    setPickupOtpError("");

    try {
      const res = await fetch(`${API_BASE}/api/seller/orders/${pickupOrder._id}/pickup-otp/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: pickupOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPickupOtpError(data.message || "Invalid or expired OTP.");
        return;
      }
      setPickupOtpMessage("OTP Verified");
      setPickupOtpExpiresAt(null);
      setPickupOtp("");
      setPickupOrder((currentOrder) => ({ ...currentOrder, status: "Out for Delivery" }));
    } catch {
      setPickupOtpError("Failed to verify OTP.");
    } finally {
      setPickupOtpLoading(false);
    }
  };

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
        <div className="w-full min-w-0">
          <div className="w-full overflow-hidden">
            <table
              className={`w-full table-fixed border-collapse text-left ${
                orderSection === "new" ? "md:min-w-[640px]" : ""
              }`}
            >
              <colgroup>
                <col className="w-[7%] md:w-auto" />
                <col className="w-[30%] md:w-auto" />
                <col className="w-[21%] md:w-auto" />
                <col className="w-[29%] md:w-auto" />
                <col className="w-[13%] md:w-auto" />
              </colgroup>

              <thead>
                <tr className="border-b border-gray-700">
                  <th className="whitespace-nowrap px-0.5 py-1 text-[8px] font-black uppercase tracking-tight text-gray-500 sm:px-2 sm:py-2 sm:text-xs">
                    S.N.
                  </th>
                  <th className="whitespace-nowrap px-0.5 py-1 text-[8px] font-black uppercase tracking-tight text-gray-500 sm:px-2 sm:py-2 sm:text-xs">
                    Order id
                  </th>
                  <th className="whitespace-nowrap px-0.5 py-1 text-[8px] font-black uppercase tracking-tight text-gray-500 sm:px-2 sm:py-2 sm:text-xs">
                    Customer
                  </th>
                  <th className="whitespace-nowrap px-0.5 py-1 text-[8px] font-black uppercase tracking-tight text-gray-500 sm:px-2 sm:py-2 sm:text-xs">
                    Actions
                  </th>
                  <th className="whitespace-nowrap px-0.5 py-1 text-[8px] font-black uppercase tracking-tight text-gray-500 sm:px-2 sm:py-2 sm:text-xs">
                    View
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-700/80">
                {visibleOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 text-center text-[9px] font-black text-gray-500 sm:py-5 sm:text-xs"
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
                      <td className="whitespace-nowrap px-0.5 py-1 text-[9px] font-black text-gray-400 sm:px-2 sm:py-2 sm:text-sm">
                        {index + 1}
                      </td>

                      <td className="min-w-0 px-0.5 py-1 text-[8px] font-black text-gray-300 sm:px-2 sm:py-2 sm:text-sm">
                        <span className="block truncate">{order._id}</span>
                      </td>

                      <td className="min-w-0 px-0.5 py-1 text-[9px] font-black text-white sm:px-2 sm:py-2 sm:text-sm">
                        <span className="block truncate">
                          {order.customerId?.name || "Guest"}
                        </span>
                        {orderSection === "ready" && order.assignedRiderId && (
                          <div className="mt-1 space-y-0.5 text-[8px] font-bold text-gray-400 sm:text-[10px]">
                            <div>Rider ID: {order.assignedRiderId._id || order.assignedRiderId.id || "N/A"}</div>
                            <div>Name: {order.assignedRiderId.name || "Rider"}</div>
                            <div>Phone: {order.assignedRiderId.phone || "N/A"}</div>
                          </div>
                        )}
                      </td>

                      <td className="px-0.5 py-1 sm:px-2 sm:py-2">
                        <div className="flex min-w-0 items-center gap-0.5 whitespace-nowrap sm:gap-1.5">
                          {order.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateOrderStatus(order._id, "Accepted")
                                }
                                className="rounded bg-green-600 px-1 py-0.5 text-[7px] font-black text-white transition hover:bg-green-500 active:scale-95 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
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
                                className="rounded bg-red-600 px-1 py-0.5 text-[7px] font-black text-white transition hover:bg-red-500 active:scale-95 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
                              >
                                Reject
                              </button>
                            </>
                          ) : order.status === "Preparing" ? (
                            <span className="whitespace-nowrap text-[8px] font-black text-orange-400 sm:text-[10px]">
                              Preparing
                            </span>
                          ) : order.status === "Accepted" ? (
                            <span className="whitespace-nowrap text-[8px] font-black text-amber-400 sm:text-[10px]">
                              Waiting for Rider
                            </span>
                          ) : order.status === "Ready for Pickup" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPickupOrder(order);
                                setPickupOtp("");
                                setPickupOtpError("");
                                setPickupOtpMessage("");
                                setPickupOtpExpiresAt(null);
                              }}
                              className="rounded bg-green-600 px-1 py-0.5 text-[7px] font-black text-white transition hover:bg-green-500 active:scale-95 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
                            >
                              Verify Rider
                            </button>
                          ) : (
                            <span className="text-[8px] font-black text-gray-500 sm:text-[10px]"></span>
                          )}
                        </div>
                      </td>

                      <td className="px-0.5 py-1 sm:px-2 sm:py-2">
                        <button
                          type="button"
                          onClick={() => openOrderDetail(order._id)}
                          className="rounded bg-orange-500 px-1 py-0.5 text-[7px] font-black text-white transition hover:bg-orange-400 active:scale-95 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[10px]"
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

      <SellerOrderDetailsOverlay
        order={selectedOrder}
        onClose={closeOrderDetail}
        onAccept={() => {
          if (!selectedOrder?._id) {
            return;
          }

          updateOrderStatus(selectedOrder._id, "Accepted");
          closeOrderDetail();
        }}
        onReject={() => {
          if (!selectedOrder?._id) {
            return;
          }

          setRejectReasonType("");
          setRejectReason("");
          setRejectingOrderId(selectedOrder._id);
          closeOrderDetail();
        }}
      />

      {pickupOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-white">Verify Rider</h3>
            <div className="mt-3 space-y-1 text-sm text-gray-300">
              <p>Rider ID: {pickupOrder.assignedRiderId?._id || pickupOrder.assignedRiderId?.id || "N/A"}</p>
              <p>Name: {pickupOrder.assignedRiderId?.name || "Rider"}</p>
              <p>Phone: {pickupOrder.assignedRiderId?.phone || "N/A"}</p>
            </div>

            {!pickupOtpExpiresAt && (
              <button
                type="button"
                onClick={sendPickupOtp}
                disabled={pickupOtpLoading}
                className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
              >
                {pickupOtpLoading ? "Sending..." : "Send OTP"}
              </button>
            )}

            {pickupOtpExpiresAt && (
              <>
                <p className="mt-4 text-sm text-gray-300">
                  OTP expires in {Math.floor(pickupOtpSeconds / 60)}:{String(pickupOtpSeconds % 60).padStart(2, "0")}
                </p>
                {pickupOtpIssuedAt && (
                  <p className="text-xs text-gray-500">Sent: {new Date(pickupOtpIssuedAt).toLocaleTimeString()}</p>
                )}
                <input
                  value={pickupOtp}
                  onChange={(event) => setPickupOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="mt-3 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-center text-xl font-black tracking-[0.4em] text-white outline-none focus:border-orange-500"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={verifyPickupOtp}
                    disabled={pickupOtpLoading || pickupOtp.length !== 6 || pickupOtpSeconds === 0}
                    className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-black text-white disabled:opacity-50"
                  >
                    Verify OTP
                  </button>
                  <button
                    type="button"
                    onClick={sendPickupOtp}
                    disabled={pickupOtpLoading}
                    className="rounded-xl bg-gray-700 px-4 py-3 font-black text-white disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                </div>
              </>
            )}

            {pickupOtpMessage && <p className="mt-3 text-sm font-bold text-green-400">{pickupOtpMessage}</p>}
            {pickupOtpError && <p className="mt-3 text-sm font-bold text-red-400">{pickupOtpError}</p>}
            <button
              type="button"
              onClick={() => setPickupOrder(null)}
              className="mt-4 w-full rounded-xl bg-gray-700 px-4 py-3 font-black text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default SellerOrders;
