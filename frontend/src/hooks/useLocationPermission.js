import { useEffect } from "react";

export default function useLocationPermission(updateLocation, denyLocation) {

    useEffect(() => {

        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(

            (position) => {

                updateLocation({

                    lat: position.coords.latitude,

                    lng: position.coords.longitude,

                });

            },

            () => {

                denyLocation();

                console.log("GPS Permission Denied.");

            }

        );

    }, []);

}