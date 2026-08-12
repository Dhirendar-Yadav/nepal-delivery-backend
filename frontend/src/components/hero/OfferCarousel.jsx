const offers = [

    {
        id: 1,
        title: "50% OFF",
        subtitle: "On your first order",
        bg: "from-orange-500 to-red-500",
    },

    {
        id: 2,
        title: "FREE DELIVERY",
        subtitle: "Orders above Rs. 999",
        bg: "from-green-500 to-emerald-500",
    },

    {
        id: 3,
        title: "Weekend Special",
        subtitle: "Flat Rs.200 OFF",
        bg: "from-blue-500 to-indigo-600",
    },

];

function OfferCarousel() {

    return (

        <div className="overflow-x-auto no-scrollbar">

            <div className="flex gap-4 w-max">

                {offers.map((offer) => (

                    <div
                        key={offer.id}
                        className={`min-w-[280px] rounded-3xl p-6 text-white bg-gradient-to-r ${offer.bg}`}
                    >

                        <h2 className="text-3xl font-black">

                            {offer.title}

                        </h2>

                        <p className="mt-2 text-sm opacity-90">

                            {offer.subtitle}

                        </p>

                    </div>

                ))}

            </div>

        </div>

    );

}

export default OfferCarousel;