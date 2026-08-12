const API_BASE =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5005";

async function request(url) {
    try {
        const response = await fetch(url);

        const data = await response.json();

        return {
            success: response.ok,
            data,
            error: response.ok
                ? null
                : data.message || "Request failed."
        };
    } catch {
        return {
            success: false,
            data: [],
            error: "Unable to connect to server."
        };
    }
}

export async function fetchRestaurants({
    search = "",
    lat = null,
    lng = null,
    categories = [],
    isPureVeg = false,
    sort = "",
    limit = 20
} = {}) {

    const params = new URLSearchParams();

    if (search.trim())
        params.append("search", search.trim());

    if (lat !== null && lng !== null) {
        params.append("lat", lat);
        params.append("lng", lng);
    }

    if (categories.length) {
        params.append(
            "categories",
            categories.join(",")
        );
    }

    if (isPureVeg)
        params.append("isPureVeg", "true");

    if (sort)
        params.append("sort", sort);

    params.append("limit", limit);

    const url =
        `${API_BASE}/api/restaurants?${params.toString()}`;

    return request(url);
}