import { useCallback, useEffect, useState } from "react";
import { fetchRestaurants } from "../services/restaurantService";

const RESTAURANT_REFRESH_INTERVAL_MS = 5000;

export default function useRestaurants() {

    const [restaurants, setRestaurants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState("");

    const loadRestaurants = useCallback(async (showLoading = true) => {

        if (showLoading) {
            setIsLoading(true);
        }

        const result = await fetchRestaurants();

        if (result.success) {
            setRestaurants(result.data);
            setApiError("");
        } else {
            setApiError(result.error);
        }

        if (showLoading) {
            setIsLoading(false);
        }

        return result;
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initialLoad = async () => {
            const result = await loadRestaurants(true);

            if (!isMounted) return;

            if (!result.success) {
                setApiError(result.error);
            }
        };

        initialLoad();

        const refreshTimer = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;

            loadRestaurants(false);
        }, RESTAURANT_REFRESH_INTERVAL_MS);

        return () => {
            isMounted = false;
            window.clearInterval(refreshTimer);
        };
    }, [loadRestaurants]);

    return {
        restaurants,
        isLoading,
        apiError,
        refreshRestaurants: () => loadRestaurants(true),
    };
}
