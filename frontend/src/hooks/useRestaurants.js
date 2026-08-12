import { useEffect, useState } from "react";
import { fetchRestaurants } from "../services/restaurantService";

export default function useRestaurants() {

    const [restaurants, setRestaurants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [apiError, setApiError] = useState("");

    const loadRestaurants = async () => {

        setApiError("");
        setIsLoading(true);

        const result = await fetchRestaurants();

        if (result.success) {

            setRestaurants(result.data);

        } else {

            setApiError(result.error);

        }

        setIsLoading(false);

    };

    useEffect(() => {
        loadRestaurants();
    }, []);

    return {
        restaurants,
        isLoading,
        apiError,
        refreshRestaurants: loadRestaurants,
    };
}