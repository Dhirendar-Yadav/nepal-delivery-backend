import { useEffect, useState } from 'react';

export default function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsConfirming(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);

    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
    >
      <div className="w-full max-w-xs rounded-3xl border border-gray-700/80 bg-gray-900/95 p-6 shadow-2xl backdrop-blur-xl sm:max-w-sm sm:p-7">
        <div className="text-center">
          <h2
            id="logout-confirm-title"
            className="text-lg font-black text-white sm:text-xl"
          >
            Logout
          </h2>

          <p className="mt-2 text-sm font-medium leading-6 text-gray-400">
            Are you sure you want to logout?
          </p>
        </div>

        <div className="mt-7 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 py-2 text-sm font-black text-gray-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            No
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 py-2 text-sm font-black text-red-400 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? 'Logging out...' : 'Yes'}
          </button>
        </div>
      </div>
    </div>
  );
}
