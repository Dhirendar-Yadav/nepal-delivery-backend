import { createContext, useContext, useMemo, useState } from "react";

const UIContext = createContext(null);

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

export function useUI() {
    const context = useContext(UIContext);

    if (!context) {
        throw new Error("useUI must be used inside UIProvider");
    }

    return context;
}