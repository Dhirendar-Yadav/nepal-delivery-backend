import { useMemo, useState } from "react";

import { UIContext } from "./UIContext";

export function UIProvider({ children }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isFilterOpen, setFilterOpen] = useState(false);
    const [showCEOProfile, setShowCEOProfile] = useState(false);

    const value = useMemo(
        () => ({
            isSidebarOpen,
            setSidebarOpen,

            isFilterOpen,
            setFilterOpen,

            showCEOProfile,
            setShowCEOProfile,
        }),
        [
            isSidebarOpen,
            isFilterOpen,
            showCEOProfile,
        ]
    );

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}
