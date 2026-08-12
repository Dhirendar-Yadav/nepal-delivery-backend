import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./App.jsx";

import { AuthProvider } from "./context/AuthContext";
import { LocationProvider } from "./context/LocationContext";
import { UIProvider } from "./context/UIContext";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <AuthProvider>
            <LocationProvider>
                <UIProvider>
                    <App />
                </UIProvider>
            </LocationProvider>
        </AuthProvider>
    </StrictMode>
);