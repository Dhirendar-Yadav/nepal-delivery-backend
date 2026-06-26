export default function OrderManifestModal({ setIsModalOpen }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 w-96">
                <h3 className="text-white font-bold mb-4">Order Details</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-full bg-orange-600 text-white py-2 rounded font-black">CLOSE</button>
            </div>
        </div>
    );
}