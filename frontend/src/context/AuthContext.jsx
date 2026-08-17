import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
    const restoreSession = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/me`, {
                credentials: 'include'
            });

            if (!response.ok) return false;

            const data = await response.json();

            if (data.success && data.user) {
                setUser(data.user);
                setIsAuthenticated(true);
                return true;
            }
        } catch (err) {
            console.error('Session restore failed:', err);
        }

        return false;
    };

    const initializeAuth = async () => {
        await restoreSession();
        setLoading(false);
    };

    initializeAuth();
}, []);
    const login = ({ user }) => {
    if (user?.role) {
        localStorage.setItem("userRole", user.role);
    }

        if (user?.name) {
            localStorage.setItem("userName", user.name);
        }
        if (user?.phone) {
    localStorage.setItem("userPhone", user.phone);
}


setUser(user);
setIsAuthenticated(true);
    };

    const logout = async () => {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (err) {
        console.error('Logout request failed:', err);
    }

    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPhone");


    setUser(null);
    setIsAuthenticated(false);
};

    const value = useMemo(
        () => ({
            user,
            loading,
            isAuthenticated,
            login,
            logout,
        }),
        [user, loading, isAuthenticated]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
