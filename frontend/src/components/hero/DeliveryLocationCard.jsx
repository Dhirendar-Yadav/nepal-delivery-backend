import { MapPin } from "lucide-react";
import { useLocation } from "../../hooks/useLocation";

function DeliveryLocationCard() {

    const {
        location,
        permission,
    } = useLocation();

    return (

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">

            <div className="flex items-center gap-3">

                <div className="bg-orange-100 p-3 rounded-xl">

                    <MapPin
                        className="text-orange-500"
                        size={20}
                    />

                </div>

                <div>

                    <p className="text-xs text-gray-500 font-semibold">

                        Deliver To

                    </p>

                    {

                        permission === "granted"

                            ? (

                                <h3 className="font-black text-gray-900">

                                    {location?.address || "Fetching address..."}

                                </h3>

                            )

                            : (

                                <h3 className="font-black text-orange-500">

                                    Choose Delivery Location

                                </h3>

                            )

                    }

                </div>

            </div>

        </div>

    );

}

export default DeliveryLocationCard;
