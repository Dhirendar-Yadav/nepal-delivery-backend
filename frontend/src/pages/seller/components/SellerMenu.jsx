import { createPortal } from 'react-dom';
import UniversalImageEditor from '../../../components/UniversalImageEditor';

function SellerMenu({
  myItems,
  editingMenuItem,
  setEditingMenuItem,
  itemName,
  setItemName,
  itemPrice,
  setItemPrice,
  itemDescription,
  setItemDescription,
  itemFoodCategory,
  setItemFoodCategory,
  itemTags,
  setItemTags,
  isMenuSheetOpen,
  setIsMenuSheetOpen,
  isMenuImageOverlayOpen,
  setIsMenuImageOverlayOpen,
  menuImageBlob,
  setMenuImageBlob,
  handleAddItem,
  handleEditMenuItem,
  handleDeleteMenuItem
}) {
  return (
    <>
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-xl font-black text-white sm:text-2xl">
            Menu Management
          </h2>

          <button
            type="button"
            onClick={() => {
              setEditingMenuItem(null);
              setItemName('');
              setItemPrice('');
              setItemDescription('');
              setItemFoodCategory('Veg');
              setItemTags('');
              setIsMenuSheetOpen(true);
            }}
            className="shrink-0 px-1 py-1 text-sm font-bold text-orange-400 transition-all duration-200 hover:scale-105 hover:text-orange-300 active:scale-95 sm:text-base"
          >
            Add Items
          </button>
        </div>

        <div className="w-full">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_118px] items-center gap-x-5 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500 sm:grid-cols-[minmax(0,1fr)_110px_145px] sm:gap-x-8">
            <span>Items</span>
            <span>Price</span>
            <span className="text-right">Actions</span>
          </div>

          {myItems.length === 0 ? (
            <div className="py-8 text-sm font-medium text-gray-500">
              No active menu items.
            </div>
          ) : (
            <div className="w-full">
              {myItems.map((item) => (
                <div
                  key={item._id}
                  className="grid grid-cols-[minmax(0,1fr)_80px_118px] items-center gap-x-5 py-3 sm:grid-cols-[minmax(0,1fr)_110px_145px] sm:gap-x-8"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white sm:text-base">
                      {item.name}
                    </p>
                  </div>

                  <div className="whitespace-nowrap text-sm font-semibold text-gray-200 sm:text-base">
                    NPR {item.price}
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-5">
                    <button
                      type="button"
                      onClick={() => handleEditMenuItem(item)}
                      className="px-1 py-1 text-xs font-semibold text-gray-300 transition hover:text-white sm:px-2 sm:text-sm"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMenuItem(item)}
                      className="px-1 py-1 text-xs font-semibold text-red-400 transition hover:text-red-300 sm:px-2 sm:text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {isMenuSheetOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 px-4 py-4 backdrop-blur-xl backdrop-saturate-125"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsMenuImageOverlayOpen(false);
                setMenuImageBlob(null);
                setEditingMenuItem(null);
                setIsMenuSheetOpen(false);
              }
            }}
          >
            <div
              className="w-full max-h-[90vh] max-w-sm overflow-y-auto rounded-3xl bg-white/[0.07] px-4 pb-4 pt-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-md sm:px-5"
              role="dialog"
              aria-modal="true"
              aria-label="Add a new item to your restaurant menu"
            >
              <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-white/20" />

              <h3 className="mb-3 text-center text-base font-black text-white sm:text-lg">
                {editingMenuItem ? 'Edit menu item' : 'Add a new item to your restaurant menu'}
              </h3>

              <form
                onSubmit={async (e) => {
                  const saved = await handleAddItem(e);

                  if (saved) {
                    setIsMenuSheetOpen(false);
                  }
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2.5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                      Item Name
                    </label>

                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                      placeholder="Momo"
                      required
                      maxLength="150"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                      Price (NPR)
                    </label>

                    <input
                      type="number"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="w-full rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                      placeholder="150"
                      required
                      min="100"
                      step="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                    Description
                  </label>

                  <textarea
                    value={itemDescription}
                    onChange={(e) =>
                      setItemDescription(e.target.value)
                    }
                    className="w-full resize-none rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                    rows="2"
                    placeholder="Delicious hot momos..."
                    required
                    maxLength="500"
                  />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2.5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                      Tags
                    </label>

                    <input
                      type="text"
                      value={itemTags}
                      onChange={(e) =>
                        setItemTags(e.target.value)
                      }
                      className="w-full rounded-lg bg-black/15 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-orange-400/50"
                      placeholder="spicy, popular"
                      maxLength="500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-300">
                      Food Category
                    </label>

                    <select
                      value={itemFoodCategory}
                      onChange={(e) =>
                        setItemFoodCategory(e.target.value)
                      }
                      className="w-full rounded-lg bg-gray-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-orange-400/50"
                    >
                      <option
                        value="Veg"
                        className="bg-gray-900 text-white"
                      >
                        Veg
                      </option>
                      <option
                        value="Non-Veg"
                        className="bg-gray-900 text-white"
                      >
                        Non-Veg
                      </option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuImageOverlayOpen(true);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-200 ring-1 ring-white/10 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.99]"
                  >
                    {menuImageBlob
                      ? 'Change Image'
                      : editingMenuItem
                        ? 'Change Image'
                        : 'Add Image'}
                  </button>

                  <UniversalImageEditor
                    open={isMenuImageOverlayOpen}
                    ariaLabel="Menu image"
                    onClose={() => {
                      setIsMenuImageOverlayOpen(false);
                    }}
                    onSave={async ({ blob }) => {
                      setMenuImageBlob(blob);
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuImageOverlayOpen(false);
                      setMenuImageBlob(null);
                      setEditingMenuItem(null);
                      setIsMenuSheetOpen(false);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.99]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-white/[0.07] hover:text-orange-200 active:scale-[0.99]"
                  >
                    {editingMenuItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default SellerMenu;
