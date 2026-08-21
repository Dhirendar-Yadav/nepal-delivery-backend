import { useEffect } from "react";

export default function useLocationPermission(updateLocation, denyLocation) {
    useEffect(() => {
        if (!navigator.geolocation) {
            denyLocation();
            return;
        }

        let permissionStatus = null;

        const fetchAddress = async (lat, lng) => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1&namedetails=1&extratags=1&layer=poi,address&accept-language=en`
                );

                if (!response.ok) {
                    throw new Error(`Reverse geocoding failed with status ${response.status}`);
                }

                const data = await response.json();

                const shortAddress = String(
                    data.name ||
                    data.namedetails?.name ||
                    data.address?.amenity ||
                    data.address?.building ||
                    data.address?.shop ||
                    data.address?.tourism ||
                    data.address?.office ||
                    data.address?.road ||
                    data.address?.neighbourhood ||
                    data.address?.suburb ||
                    data.address?.quarter ||
                    data.address?.village ||
                    data.address?.town ||
                    data.address?.city ||
                    data.address?.municipality ||
                    data.display_name?.split(",")[0] ||
                    "Location unavailable"
                )
                    .replace(/\s+/g, " ")
                    .trim();

                const address = data.display_name || shortAddress;

                updateLocation({
                    lat,
                    lng,
                    address,
                    shortAddress
                });
            } catch (error) {
                console.error("Reverse geocoding failed:", error);

                updateLocation({
                    lat,
                    lng,
                    address: null,
                    shortAddress: null,
                    locationError: true
                });
            }
        };

        const requestCurrentLocation = () => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    fetchAddress(lat, lng);
                },
                (error) => {
                    denyLocation();
                    console.error("GPS Permission Denied:", error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        };

        const handlePermissionChange = () => {
            if (!permissionStatus) return;

            if (permissionStatus.state === "denied") {
                denyLocation();
                return;
            }

            if (permissionStatus.state === "granted") {
                requestCurrentLocation();
            }
        };

        requestCurrentLocation();

        if (navigator.permissions?.query) {
            navigator.permissions
                .query({ name: "geolocation" })
                .then((status) => {
                    permissionStatus = status;
                    permissionStatus.addEventListener(
                        "change",
                        handlePermissionChange
                    );

                    handlePermissionChange();
                })
                .catch((error) => {
                    console.warn(
                        "Geolocation permission monitoring unavailable:",
                        error
                    );
                });
        }

        return () => {
            if (permissionStatus) {
                permissionStatus.removeEventListener(
                    "change",
                    handlePermissionChange
                );
            }
        };
    }, [denyLocation, updateLocation]);
}
