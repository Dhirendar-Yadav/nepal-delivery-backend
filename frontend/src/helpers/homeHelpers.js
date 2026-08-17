export const handleRestaurantClick = (id, navigate, isAuthenticated) => {

    if (!isAuthenticated) {

        alert("Please log in to place an order!");

        navigate("/login");

        return;

    }

    navigate(`/menu/${id}`);

};

export const handleClearFilters = (
    setSearchQuery,
    setSelectedCategories,
    setSelectedSorts,
    setIsPureVeg
) => {

    setSearchQuery("");

    setSelectedCategories([]);

    setSelectedSorts([]);

    setIsPureVeg(false);

};
