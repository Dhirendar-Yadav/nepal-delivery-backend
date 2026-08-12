import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import SearchBar from "../../components/common/SearchBar";
import RestaurantCard from "../../components/RestaurantCard";
import EmptyState from "../../components/EmptyState";
import SkeletonCard from "../../components/SkeletonCard";

import { fetchRestaurants } from "../../services/restaurantService";
import { useLocation } from "../../context/LocationContext";
import { handleRestaurantClick } from "../../helpers/homeHelpers";

function SearchPage() {

    const navigate = useNavigate();

    const { location } = useLocation();

    const [query, setQuery] = useState("");

    const [restaurants, setRestaurants] = useState([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {

        const timer = setTimeout(async () => {

            setLoading(true);

            const result = await fetchRestaurants({

                search: query,

                lat: location?.lat,

                lng: location?.lng,

                limit: 50,

            });

            if (result.success) {

                setRestaurants(result.data);

            } else {

                setRestaurants([]);

            }

            setLoading(false);

        }, 300);

        return () => clearTimeout(timer);

    }, [query, location]);

    return (

        <div className="min-h-screen bg-gray-50">

            {/* Header */}

            <div className="sticky top-0 bg-white z-20 border-b">

                <div className="flex items-center gap-3 p-4">

                    <button

                        onClick={() => navigate(-1)}

                        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"

                    >

                        <ArrowLeft size={20} />

                    </button>

                    <div className="flex-1">

                        <SearchBar

                            value={query}

                            onChange={(e) => setQuery(e.target.value)}

                            placeholder="Search restaurants, food..."

                        />

                    </div>

                </div>

            </div>

            {/* Body */}

            <div className="p-4">

                {

                    loading ? (

                        <div className="grid grid-cols-2 gap-4">

                            {

                                [...Array(6)].map((_, index) => (

                                    <SkeletonCard key={index} />

                                ))

                            }

                        </div>

                    ) : restaurants.length === 0 ? (

                        <EmptyState

                            icon="🔍"

                            title="Nothing Found"

                            message="Try searching restaurants, momo, pizza, burger..."

                        />

                    ) : (

                        <>

                            <p className="text-sm font-bold text-gray-500 mb-4">

                                {restaurants.length} Results

                            </p>

                            <div className="grid grid-cols-2 gap-4">

                                {

                                    restaurants.map((restaurant) => (

                                        <RestaurantCard

                                            key={restaurant._id}

                                            restaurant={restaurant}

                                            userLocation={location}

                                            handleRestaurantClick={(id) =>

                                                handleRestaurantClick(id, navigate)

                                            }

                                        />

                                    ))

                                }

                            </div>

                        </>

                    )

                }

            </div>

        </div>

    );

}

export default SearchPage;