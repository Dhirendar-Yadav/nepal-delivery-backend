export default function KpiCards({ stats, fleetSize }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="kpi-card">
                <span className="text-[10px] text-gray-500 font-black uppercase">Fleet Size</span>
                <span className="text-2xl font-black text-white">{fleetSize} <span className="text-[10px] text-orange-500">RIDERS</span></span>
            </div>
            <div className="kpi-card">
                <span className="text-[10px] text-gray-500 font-black uppercase">Daily Orders</span>
                <span className="text-2xl font-black text-white">{stats?.dailyOrders || 0}</span>
            </div>
            <div className="kpi-card">
                <span className="text-[10px] text-gray-500 font-black uppercase">Daily Vol</span>
                <span className="text-2xl font-black text-white">NPR {stats?.dailyRevenue || 0}</span>
            </div>
            <div className="kpi-card">
                <span className="text-[10px] text-gray-500 font-black uppercase">Net Profit</span>
                <span className="text-2xl font-black text-white">NPR {stats?.netProfit || 0}</span>
            </div>
            <div className="kpi-card">
                <span className="text-[10px] text-gray-500 font-black uppercase">Liquid Reserve</span>
                <span className="text-2xl font-black text-green-500">NPR {stats?.availableBalance || 0}</span>
            </div>
        </div>
    );
}