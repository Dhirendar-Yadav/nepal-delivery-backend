import { calculateDistance } from "../utils/distance";
export default function useRestaurantFilters({
    restaurants,
    userLocation,
    searchQuery,
    selectedCategories,
    selectedSorts,
    isPureVeg
}) {

    return restaurants
        .map(r => {

            const dist = userLocation
                ? calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    r.latitude,
                    r.longitude
                )
                : 0;

            const searchLower = searchQuery.toLowerCase().trim();

            const matchesName =
                r.name.toLowerCase().includes(searchLower);

            const matchesType =
                r.foodType &&
                r.foodType.toLowerCase().includes(searchLower);

            const matchedMenuItems = r.menu
                ? r.menu.filter(item =>
                    item.name &&
                    item.name.toLowerCase().includes(searchLower)
                )
                : [];

            const hasMatchingItem =
                matchedMenuItems.length > 0;

            let badgeText = null;

            if (
                searchLower !== "" &&
                !matchesName &&
                hasMatchingItem
            ) {
                badgeText =
                    `✨ ${matchedMenuItems[0].name} available here`;
            }

            return {
                ...r,
                distance: dist,
                matchesSearch:
                    matchesName ||
                    matchesType ||
                    hasMatchingItem ||
                    searchLower === "",

                badgeText,
                isOpen: r.isOpen,
                offerTag: r.offerTag || null
            };

        })
        .filter(r => {

            if (!r.matchesSearch)
                return false;

            const matchesCategory =
                selectedCategories.length === 0
                    ? true
                    : (
                        r.foodType &&
                        selectedCategories.some(cat =>
                            r.foodType
                                .toLowerCase()
                                .includes(cat.toLowerCase())
                        )
                    );

            const matchesPureVeg =
                isPureVeg
                    ? r.isPureVeg === true
                    : true;

            return (
                matchesCategory &&
                matchesPureVeg
            );

        })
        .sort((a, b) => {

            if (searchQuery.trim() !== "") {
                return a.distance - b.distance;
            }

            for (let sort of selectedSorts) {

                if (
                    sort === "Rating" &&
                    (b.rating || 0) !== (a.rating || 0)
                ) {
                    return (b.rating || 0) - (a.rating || 0);
                }

                if (
                    sort === "Nearest" &&
                    a.distance !== b.distance
                ) {
                    return a.distance - b.distance;
                }

            }

            return a.distance - b.distance;

        });

}