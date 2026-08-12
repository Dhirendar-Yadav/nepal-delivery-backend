import {
    Tag,
    Leaf,
    Star,
    Bike,
    Pizza,
    Beef,
    Coffee,
    Sandwich,
} from "lucide-react";

const iconMap = {
    offer: Tag,
    veg: Leaf,
    rating: Star,
    delivery: Bike,
    pizza: Pizza,
    momo: Sandwich,
    coffee: Coffee,
    meat: Beef,
};


function QuickActions({

    actions,

}) {

    return (

        <div className="grid grid-cols-4 gap-3">

            {actions.map((item) => {

                const Icon = iconMap[item.icon] || Tag;

                return (

                    <button
                        key={item.title}
                        className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 p-2 md:p-3 flex flex-col items-center justify-center active:scale-95 transition hover:shadow-md"
                    >

                        <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
    item.color || "bg-orange-100 text-orange-600"
}`}
                        >

                            <Icon size={22} />

                        </div>

                        <span className="text-xs font-semibold mt-2 text-center">

                            {item.title}

                        </span>

                    </button>

                );

            })}

        </div>

    );

}

export default QuickActions;