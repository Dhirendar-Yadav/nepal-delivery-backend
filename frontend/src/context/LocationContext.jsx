import { useCallback, useMemo, useState } from "react";

import { LocationContext } from "./LocationContext";

export function LocationProvider({ children }) {
    const [location, setLocation] = useState(null);
    const [permission, setPermission] = useState("unknown");

    const updateLocation = useCallback((coords) => {
        setLocation(coords);
        setPermission("granted");
    }, []);

    const denyLocation = useCallback(() => {
        setLocation(null);
        setPermission("denied");
    }, []);

    const clearLocation = useCallback(() => {
        setLocation(null);
        setPermission("unknown");
    }, []);

    const value = useMemo(
        () => ({
            location,
            permission,
            updateLocation,
            denyLocation,
            clearLocation,
        }),
        [location, permission, updateLocation, denyLocation, clearLocation]
    );

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
}
