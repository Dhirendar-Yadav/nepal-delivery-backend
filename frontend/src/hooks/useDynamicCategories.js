import { useMemo } from "react";
import { masterIconList } from "../constants/categoryIcons";

export default function useDynamicCategories(restaurants) {

    return useMemo(() => {

        if (!restaurants || restaurants.length === 0) {

            return {
                dynamicIcons: [],
                dynamicSidebarCategories: [],
            };

        }

        const availableKeywords = new Set();

        restaurants.forEach((restaurant) => {

            if (restaurant.foodType) {

                availableKeywords.add(
                    restaurant.foodType.toLowerCase().trim()
                );

            }

            if (restaurant.menu && Array.isArray(restaurant.menu)) {

                restaurant.menu.forEach((item) => {

                    if (item.name) {

                        availableKeywords.add(
                            item.name.toLowerCase().trim()
                        );

                    }

                });

            }

        });

        const dynamicIcons = masterIconList.filter((item) =>
            Array.from(availableKeywords).some((keyword) =>
                keyword.includes(item.keyword)
            )
        );

        const uniqueTypes = new Set();

        restaurants.forEach((restaurant) => {

            if (restaurant.foodType) {

                restaurant.foodType
                    .split(",")
                    .forEach((type) =>
                        uniqueTypes.add(type.trim())
                    );

            }

        });

        return {

            dynamicIcons,

            dynamicSidebarCategories: Array.from(uniqueTypes),

        };

    }, [restaurants]);

}