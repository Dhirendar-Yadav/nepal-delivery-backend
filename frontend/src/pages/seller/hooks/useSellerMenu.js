import { useCallback, useState } from 'react';

export default function useSellerMenu({ API_BASE }) {
  const [myItems, setMyItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFoodCategory, setItemFoodCategory] = useState('Veg');
  const [itemTags, setItemTags] = useState('');
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
  const [isMenuImageOverlayOpen, setIsMenuImageOverlayOpen] = useState(false);
  const [menuImageBlob, setMenuImageBlob] = useState(null);

  const fetchMyMenu = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/seller/menu`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setMyItems(data);
      } else {
        console.error("Menu 400 Error:", data.error || "Restaurant Not Linked");
      }
    } catch (error) {
      console.error("Menu fetch error:", error);
    }
  }, [API_BASE]);

  const handleAddItem = useCallback(async (e) => {
    e.preventDefault();

    const normalizedName = itemName.trim();
    const normalizedDescription = itemDescription.trim();
    const numericPrice = Number(itemPrice);
    const normalizedTags = [
      ...new Set(
        itemTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ];

    const isEditing = Boolean(editingMenuItem?._id);
    const hasMenuImage = Boolean(menuImageBlob);

    if (!normalizedName) {
      console.error('Menu item name is required.');
      return false;
    }

    if (
      !Number.isInteger(numericPrice) ||
      numericPrice < 100
    ) {
      console.error(
        'Menu item price must be a whole number of at least NPR 100.'
      );
      return false;
    }

    if (
      itemFoodCategory !== 'Veg' &&
      itemFoodCategory !== 'Non-Veg'
    ) {
      console.error('Menu item food category must be Veg or Non-Veg.');
      return false;
    }

    if (normalizedTags.length > 10) {
      console.error('A menu item can have a maximum of 10 tags.');
      return false;
    }

    if (normalizedTags.some((tag) => tag.length > 50)) {
      console.error('Each menu tag must be 50 characters or fewer.');
      return false;
    }

    if (
      isEditing &&
      (!Number.isInteger(editingMenuItem.__v) ||
        editingMenuItem.__v < 0)
    ) {
      console.error('Menu item version is missing or invalid.');
      return false;
    }

    const endpoint = isEditing
      ? `${API_BASE}/api/seller/menu/${encodeURIComponent(
          editingMenuItem._id
        )}`
      : `${API_BASE}/api/seller/menu`;

    const method = isEditing ? 'PATCH' : 'POST';

    const payload = {
      name: normalizedName,
      price: numericPrice,
      description: normalizedDescription,
      foodCategory: itemFoodCategory,
      tags: normalizedTags
    };

    if (isEditing) {
      payload.__v = editingMenuItem.__v;
    }

    try {
      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          console.error(
            'Menu item was changed by another request. Refreshing menu.'
          );
          await fetchMyMenu();
          return false;
        }

        console.error(
          `Failed: ${data.error || data.message || 'Invalid Data'}`
        );
        return false;
      }

      let savedItem = data.item;

      if (
        hasMenuImage &&
        savedItem?._id &&
        Number.isInteger(savedItem.__v)
      ) {
        const imageFormData = new FormData();

        imageFormData.append(
          'menuImage',
          menuImageBlob,
          'menu-image.jpg'
        );

        imageFormData.append(
          '__v',
          String(savedItem.__v)
        );

        const imageResponse = await fetch(
          `${API_BASE}/api/seller/menu/${encodeURIComponent(
            savedItem._id
          )}/image`,
          {
            method: 'POST',
            credentials: 'include',
            body: imageFormData
          }
        );

        const imageData = await imageResponse.json();

        if (!imageResponse.ok) {
          if (imageResponse.status === 409) {
            console.error(
              'Menu item changed before image upload. Refreshing menu.'
            );
          } else {
            console.error(
              `Menu image upload failed: ${
                imageData.error ||
                imageData.message ||
                'Unable to upload image.'
              }`
            );
          }

          await fetchMyMenu();
          return false;
        }

        savedItem = imageData.item || savedItem;
      }

      setItemName('');
      setItemPrice('');
      setItemDescription('');
      setItemFoodCategory('Veg');
      setItemTags('');
      setEditingMenuItem(null);
      setMenuImageBlob(null);
      setIsMenuImageOverlayOpen(false);

      await fetchMyMenu();

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(
          isEditing ? 'Item Updated!' : 'Item Added!',
          {
            body: `${normalizedName} ${
              isEditing ? 'was updated.' : 'is now live.'
            }`
          }
        );
      }

      return true;
    } catch (error) {
      console.error(
        `Network Error while ${
          isEditing ? 'updating' : 'adding'
        } menu item:`,
        error
      );

      return false;
    }
  }, [
    API_BASE,
    editingMenuItem,
    fetchMyMenu,
    itemDescription,
    itemFoodCategory,
    itemName,
    itemPrice,
    itemTags,
    menuImageBlob
  ]);

  const handleDeleteMenuItem = useCallback(async (item) => {
    if (!item?._id) {
      console.error('Menu item ID is missing.');
      return;
    }

    if (!Number.isInteger(item.__v) || item.__v < 0) {
      console.error('Menu item version is missing or invalid.');
      return;
    }

    const confirmed = window.confirm(
      `Delete "${item.name}" from your menu?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/seller/menu/${encodeURIComponent(item._id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            __v: item.__v
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        await fetchMyMenu();
        return;
      }

      if (response.status === 409) {
        console.error(
          'Menu item was changed by another request. Refreshing menu.'
        );
        await fetchMyMenu();
        return;
      }

      console.error(
        `Menu delete failed: ${data.error || data.message || 'Invalid request'}`
      );
    } catch (error) {
      console.error('Network Error while deleting menu item:', error);
    }
  }, [API_BASE, fetchMyMenu]);

  const handleEditMenuItem = useCallback((item) => {
    if (!item?._id) {
      console.error('Menu item ID is missing.');
      return;
    }

    if (!Number.isInteger(item.__v) || item.__v < 0) {
      console.error('Menu item version is missing or invalid.');
      return;
    }

    setEditingMenuItem(item);
    setItemName(item.name || '');
    setItemPrice(
      item.price !== undefined && item.price !== null
        ? String(item.price)
        : ''
    );
    setItemDescription(item.description || '');
    setItemFoodCategory(
      item.foodCategory === 'Non-Veg'
        ? 'Non-Veg'
        : 'Veg'
    );
    setItemTags(
      Array.isArray(item.tags)
        ? item.tags.join(', ')
        : ''
    );
    setIsMenuSheetOpen(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  return {
    myItems,
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
    editingMenuItem,
    setEditingMenuItem,
    isMenuSheetOpen,
    setIsMenuSheetOpen,
    isMenuImageOverlayOpen,
    setIsMenuImageOverlayOpen,
    menuImageBlob,
    setMenuImageBlob,
    fetchMyMenu,
    handleAddItem,
    handleDeleteMenuItem,
    handleEditMenuItem
  };
}
