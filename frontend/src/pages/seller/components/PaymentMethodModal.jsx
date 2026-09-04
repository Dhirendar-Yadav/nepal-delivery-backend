import { useState } from 'react';
import { createPortal } from 'react-dom';

const PAYMENT_METHODS = [
  { value: 'Bank', label: 'Bank' },
  { value: 'eSewa', label: 'eSewa' }
];

const createEmptyFields = () => ({
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  eSewaId: ''
});

function PaymentMethodModal({
  isOpen,
  title = 'Add Payment Method',
  initialMethod = 'Bank',
  initialValues = {},
  loading = false,
  error = '',
  onSave,
  onCancel
}) {
  const [method, setMethod] = useState(initialMethod);
  const [fields, setFields] = useState(() => ({
    ...createEmptyFields(),
    ...initialValues
  }));
  const [localError, setLocalError] = useState('');

  if (!isOpen) {
    return null;
  }

  const updateField = (field, value) => {
    setFields((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    try {
      await onSave({
        method,
        accountName: fields.accountHolderName,
        bankName: fields.bankName,
        accountNumber: fields.accountNumber,
        eSewaId: fields.eSewaId
      });
    } catch (submitError) {
      setLocalError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save payment method.'
      );
    }
  };

  const displayedError = error || localError;

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[64px] z-[130] flex items-center justify-center bg-black/35 px-2 py-3 backdrop-blur-xl backdrop-saturate-125 sm:px-4 sm:py-4 md:top-[84px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gray-900/90 shadow-2xl backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-method-modal-title"
      >
        <div className="border-b border-gray-700 px-4 py-4 sm:px-5">
          <h2
            id="payment-method-modal-title"
            className="text-base font-black text-white sm:text-lg"
          >
            {title}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 px-4 py-4 sm:px-5 sm:py-5"
        >
          <div>
            <label
              htmlFor="payment-method"
              className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400"
            >
              Payment Method
            </label>

            <select
              id="payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-gray-700 bg-gray-800/90 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {PAYMENT_METHODS.map((paymentMethod) => (
                <option
                  key={paymentMethod.value}
                  value={paymentMethod.value}
                >
                  {paymentMethod.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="account-holder-name"
              className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400"
            >
              Account Holder&apos;s Name
            </label>

            <input
              id="account-holder-name"
              type="text"
              value={fields.accountHolderName}
              onChange={(event) =>
                updateField('accountHolderName', event.target.value)
              }
              autoComplete="name"
              maxLength={100}
              disabled={loading}
              placeholder="Enter account holder's name"
              className="w-full rounded-xl border border-gray-700 bg-gray-800/90 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-500 transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
          </div>

          {method === 'Bank' ? (
            <>
              <div>
                <label
                  htmlFor="bank-name"
                  className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400"
                >
                  Bank Name
                </label>

                <input
                  id="bank-name"
                  type="text"
                  value={fields.bankName}
                  onChange={(event) =>
                    updateField('bankName', event.target.value)
                  }
                  autoComplete="organization"
                  maxLength={100}
                  disabled={loading}
                  placeholder="Enter bank name"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/90 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-500 transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="bank-account-number"
                  className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400"
                >
                  Account Number
                </label>

                <input
                  id="bank-account-number"
                  type="text"
                  value={fields.accountNumber}
                  onChange={(event) =>
                    updateField('accountNumber', event.target.value)
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={34}
                  disabled={loading}
                  placeholder="Enter bank account number"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/90 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-500 transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label
                htmlFor="esewa-mobile-number"
                className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400"
              >
                eSewa Mobile Number
              </label>

              <input
                id="esewa-mobile-number"
                type="tel"
                value={fields.eSewaId}
                onChange={(event) =>
                  updateField('eSewaId', event.target.value)
                }
                inputMode="tel"
                autoComplete="tel"
                maxLength={40}
                disabled={loading}
                placeholder="Enter eSewa mobile number"
                className="w-full rounded-xl border border-gray-700 bg-gray-800/90 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-gray-500 transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                required
              />
            </div>
          )}

          {displayedError ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
              {displayedError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-gray-700 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-gray-700 px-4 py-2.5 text-xs font-black text-gray-300 transition hover:bg-gray-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-black text-gray-950 transition hover:bg-orange-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default PaymentMethodModal;
