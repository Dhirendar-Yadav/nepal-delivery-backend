import { createContext, useContext, useMemo, useState } from "react";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
    const [location, setLocation] = useState(null);
    const [permission, setPermission] = useState("unknown");

    const updateLocation = (coords) => {
        setLocation(coords);
        setPermission("granted");
    };

    const denyLocation = () => {
        setPermission("denied");
    };

    const clearLocation = () => {
        setLocation(null);
        setPermission("unknown");
    };

    const value = useMemo(
        () => ({
            location,
            permission,
            updateLocation,
            denyLocation,
            clearLocation,
        }),
        [location, permission]
    );

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);

    if (!context) {
        throw new Error("useLocation must be used inside LocationProvider");
    }

    return context;
}