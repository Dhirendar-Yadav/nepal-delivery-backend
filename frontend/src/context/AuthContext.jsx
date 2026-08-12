import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        const storedRole = localStorage.getItem("userRole");
        const storedName = localStorage.getItem("userName");
        const storedPhone = localStorage.getItem("userPhone");

        if (storedToken) {
            setToken(storedToken);

            setUser({
    role: storedRole || "customer",
    name: storedName || "",
    phone: storedPhone || "",
});

            setIsAuthenticated(true);
        }

        setLoading(false);
    }, []);

    const login = ({ token, user }) => {
        localStorage.setItem("token", token);

        if (user?.role) {
            localStorage.setItem("userRole", user.role);
        }

        if (user?.name) {
            localStorage.setItem("userName", user.name);
        }
        if (user?.phone) {
    localStorage.setItem("userPhone", user.phone);
}

        setToken(token);
        setUser(user);
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userName");
        localStorage.removeItem("userPhone");

        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
    };

    const value = useMemo(
        () => ({
            user,
            token,
            loading,
            isAuthenticated,
            login,
            logout,
        }),
        [user, token, loading, isAuthenticated]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
}