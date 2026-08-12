import React from "react";

const statusColors = {
    Pending: "bg-yellow-100 text-yellow-700",
    Confirmed: "bg-blue-100 text-blue-700",
    Preparing: "bg-orange-100 text-orange-700",
    "Out for Delivery": "bg-purple-100 text-purple-700",
    Delivered: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-700",
};

export default function OrderCard({ order }) {
    const restaurant = order.restaurantId || {};

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">

            <div className="p-5">

                <div className="flex justify-between items-start">

                    <div className="flex gap-4">

                        <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
                            🍽️
                        </div>

                        <div>

                            <h3 className="text-lg font-bold">
                                {restaurant.name || "Restaurant"}
                            </h3>

                            <p className="text-sm text-gray-500">
                                Order #{order._id.slice(-6)}
                            </p>

                            <p className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleString()}
                            </p>

                        </div>

                    </div>

                    <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            statusColors[order.status] ||
                            "bg-gray-100 text-gray-700"
                        }`}
                    >
                        {order.status}
                    </span>

                </div>

                <div className="border-t my-4"></div>

                <div className="space-y-2">

                    {(order.items || []).map((item, index) => (
                        <div
                            key={index}
                            className="flex justify-between text-sm"
                        >
                            <span>
                                {item.quantity} × {item.name}
                            </span>

                            <span>
                                Rs. {((item.price || 0) / 100).toFixed(2)}
                            </span>

                        </div>
                    ))}

                </div>

                <div className="border-t my-4"></div>

                <div className="flex justify-between items-center">

                    <div>

                        <div className="text-sm text-gray-500">
                            Total Amount
                        </div>

                        <div className="text-xl font-bold text-orange-600">
                            Rs. {(order.totalAmount / 100).toFixed(2)}
                        </div>

                    </div>

                    <button
                        className="px-5 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition"
                    >
                        View Details
                    </button>

                </div>

            </div>

        </div>
    );
}