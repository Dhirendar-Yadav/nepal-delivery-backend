import { useState } from 'react';
import { createPortal } from 'react-dom';
import PaymentMethodModal from './PaymentMethodModal';

function SellerAccount({
  API_BASE,
  fetchRestaurant,
  restaurant,
  isStatementModalOpen,
  setIsStatementModalOpen,
  setStatementPage,
  statementPage,
  loadSellerStatement,
  statementFromDate,
  statementToDate,
  setStatementFromDate,
  setStatementToDate,
  statementLoading,
  statementError,
  setStatementError,
  statementTransactions,
  statementTotalPages,
  statementHasNextPage
}) {
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [paymentMethodSaving, setPaymentMethodSaving] = useState(false);
  const [paymentMethodError, setPaymentMethodError] = useState('');

  const hasPaymentMethod =
    restaurant?.payoutSettings?.method === 'Bank'
      ? Boolean(
          restaurant.payoutSettings.bankDetails?.accountName &&
          restaurant.payoutSettings.bankDetails?.bankName &&
          restaurant.payoutSettings.bankDetails?.accountNumber
        )
      : restaurant?.payoutSettings?.method === 'eSewa'
        ? Boolean(
            restaurant.payoutSettings.eSewaAccountName &&
            restaurant.payoutSettings.eSewaId
          )
        : false;

  const handleSavePaymentMethod = async (payload) => {
    setPaymentMethodSaving(true);
    setPaymentMethodError('');

    try {
      const response = await fetch(
        `${API_BASE}/api/seller/store/payment-method`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            data.error ||
            'Unable to save payment method.'
        );
      }

      await fetchRestaurant();
      setIsPaymentMethodModalOpen(false);
    } catch (error) {
      setPaymentMethodError(
        error instanceof Error
          ? error.message
          : 'Unable to save payment method.'
      );
    } finally {
      setPaymentMethodSaving(false);
    }
  };

  return (
          <>
            <section className="w-full max-w-2xl space-y-5 sm:space-y-6">
              <div className="flex items-center justify-between gap-3 border-b border-gray-700 pb-3 sm:gap-5 sm:pb-4">
                <h2 className="text-base font-black text-white sm:text-lg">
                  ACCOUNT
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethodError('');
                    setIsPaymentMethodModalOpen(true);
                  }}
                  className="shrink-0 rounded-md px-2 py-1.5 text-[10px] font-black text-orange-400 transition hover:bg-orange-500/10 hover:text-orange-300 active:scale-[0.98] sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  {hasPaymentMethod
                    ? 'Edit Payment Method'
                    : 'Add Payment Method'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-5 sm:gap-10">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 sm:text-xs">
                    Pending Balance
                  </p>

                  <p className="mt-1 truncate text-lg font-black text-white sm:text-xl">
                    {Number.isSafeInteger(restaurant?.walletBalance)
                      ? `NPR ${(restaurant.walletBalance / 100).toLocaleString('en-NP', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                      : 'NPR -'}
                  </p>
                </div>

                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 sm:text-xs">
                    Received Amount
                  </p>

                  <p className="mt-1 truncate text-lg font-black text-white sm:text-xl">
                    {Number.isSafeInteger(restaurant?.totalSettled)
                      ? `NPR ${(restaurant.totalSettled / 100).toLocaleString('en-NP', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                      : 'NPR -'}
                  </p>
                </div>
              </div>
              {hasPaymentMethod ? (
                <div className="border-t border-gray-700 pt-4">
                  <div className="rounded-2xl border border-gray-700 bg-gray-800/60 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 sm:text-xs">
                      Payment Method
                    </p>

                    <p className="mt-2 text-sm font-black text-white">
                      {restaurant.payoutSettings.method}
                    </p>

                    {restaurant.payoutSettings.method === 'Bank' ? (
                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-gray-300">
                          <span className="font-black text-gray-500">
                            Account Holder&apos;s Name
                          </span>
                          {' — '}
                          {restaurant.payoutSettings.bankDetails?.accountName ||
                            'Not Provided'}
                        </p>

                        <p className="text-gray-300">
                          <span className="font-black text-gray-500">
                            Bank Name
                          </span>
                          {' — '}
                          {restaurant.payoutSettings.bankDetails?.bankName ||
                            'Not Provided'}
                        </p>

                        <p className="text-gray-300">
                          <span className="font-black text-gray-500">
                            Account Number
                          </span>
                          {' — '}
                          {restaurant.payoutSettings.bankDetails?.accountNumber ||
                            'Not Provided'}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-gray-300">
                          <span className="font-black text-gray-500">
                            Account Holder&apos;s Name
                          </span>
                          {' — '}
                          {restaurant.payoutSettings.eSewaAccountName ||
                            'Not Provided'}
                        </p>

                        <p className="text-gray-300">
                          <span className="font-black text-gray-500">
                            eSewa Mobile Number
                          </span>
                          {' — '}
                          {restaurant.payoutSettings.eSewaId ||
                            'Not Provided'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="border-t border-gray-700 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={async () => {
                    setIsStatementModalOpen(true);
                    setStatementPage(1);
                    await loadSellerStatement(1);
                  }}
                  className="px-1 py-1 text-xs font-black text-orange-400 transition hover:text-orange-300 active:scale-[0.98] sm:text-sm"
                >
                  Statement
                </button>
              </div>
            </section>

            <PaymentMethodModal
              isOpen={isPaymentMethodModalOpen}
              title={
                hasPaymentMethod
                  ? 'Edit Payment Method'
                  : 'Add Payment Method'
              }
              initialMethod={
                hasPaymentMethod
                  ? restaurant.payoutSettings.method
                  : 'Bank'
              }
              initialValues={
                restaurant?.payoutSettings?.method === 'Bank'
                  ? {
                      accountHolderName:
                        restaurant?.payoutSettings?.bankDetails?.accountName || '',
                      bankName:
                        restaurant?.payoutSettings?.bankDetails?.bankName || '',
                      accountNumber: '',
                      eSewaId: ''
                    }
                  : restaurant?.payoutSettings?.method === 'eSewa'
                    ? {
                        accountHolderName:
                          restaurant?.payoutSettings?.eSewaAccountName || '',
                        bankName: '',
                        accountNumber: '',
                        eSewaId: ''
                      }
                    : {
                        accountHolderName: '',
                        bankName: '',
                        accountNumber: '',
                        eSewaId: ''
                      }
              }
              loading={paymentMethodSaving}
              error={paymentMethodError}
              onSave={handleSavePaymentMethod}
              onCancel={() => {
                if (paymentMethodSaving) {
                  return;
                }

                setPaymentMethodError('');
                setIsPaymentMethodModalOpen(false);
              }}
            />

            {isStatementModalOpen &&
              createPortal(
                <div
                  className="fixed inset-x-0 bottom-0 top-[64px] z-[120] flex items-center justify-center bg-black/35 px-2 py-3 backdrop-blur-xl backdrop-saturate-125 sm:px-4 sm:py-4 md:top-[84px]"
                  onClick={() => setIsStatementModalOpen(false)}
                >
                  <div
                  className="h-fit max-h-[calc(100vh-88px)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gray-900/90 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100vh-104px)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3 sm:px-5 sm:py-4">
                    <h3 className="text-sm font-black text-white sm:text-base">
                      Statement
                    </h3>

                    <button
                      type="button"
                      onClick={() => setIsStatementModalOpen(false)}
                      className="rounded-md px-2 py-1 text-xs font-black text-gray-400 transition hover:bg-white/5 hover:text-white active:scale-[0.98]"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[calc(100vh-160px)] overflow-y-auto px-4 py-3 sm:max-h-[calc(100vh-176px)] sm:px-5 sm:py-4">
                    <div className="mb-3 border-b border-gray-800 pb-3">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <label className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 sm:text-xs">
                            From
                          </span>

                          <input
                            type="date"
                            value={statementFromDate}
                            onChange={(event) =>
                              setStatementFromDate(event.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2.5 py-2 text-xs font-bold text-white outline-none transition focus:border-orange-500"
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 sm:text-xs">
                            To
                          </span>

                          <input
                            type="date"
                            value={statementToDate}
                            onChange={(event) =>
                              setStatementToDate(event.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2.5 py-2 text-xs font-bold text-white outline-none transition focus:border-orange-500"
                          />
                        </label>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={statementLoading}
                          onClick={() => {
                            if (
                              statementFromDate &&
                              statementToDate &&
                              statementFromDate > statementToDate
                            ) {
                              setStatementError(
                                'From date cannot be later than To date.'
                              );
                              return;
                            }

                            setStatementPage(1);
                            loadSellerStatement(
                              1,
                              statementFromDate,
                              statementToDate
                            );
                          }}
                          className="rounded-md border border-gray-700 px-3 py-2 text-[10px] font-black text-gray-300 transition hover:bg-white/5 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                    {statementLoading ? (
                      <div className="py-5 text-center">
                        <p className="text-xs font-black text-gray-400 sm:text-sm">
                          Loading statement...
                        </p>
                      </div>
                    ) : statementError ? (
                      <div className="py-5 text-center">
                        <p className="text-xs font-black text-red-400 sm:text-sm">
                          {statementError}
                        </p>
                      </div>
                    ) : statementTransactions.length === 0 ? (
                      <div className="py-5 text-center">
                        <p className="text-xs font-black text-gray-400 sm:text-sm">
                          No statement transactions found.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {statementTransactions.map((transaction) => {
                          const isOrderEarning =
                            transaction.transactionType === 'ORDER_EARNING';

                          return (
                            <div
                              key={transaction.transactionId}
                              className="rounded-xl border border-gray-800 bg-gray-950/40 px-3 py-3 sm:px-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-white sm:text-sm">
                                    {isOrderEarning
                                    ? 'Order Earning'
                                    : 'Settlement Paid'}
                                  </p>

                                  <p className="mt-1 truncate text-[10px] font-medium text-gray-500 sm:text-xs">
                                    {isOrderEarning
                                      ? `Order ID: ${transaction.orderId}`
                                      : `Settlement ID: ${transaction.settlementId}`}
                                  </p>
                                </div>

                                <p
                                  className={`shrink-0 text-xs font-black sm:text-sm ${
                                    isOrderEarning
                                      ? 'text-green-400'
                                      : 'text-red-400'
                                  }`}
                                >
                                  {isOrderEarning ? '+' : '-'} NPR {(
                                    transaction.amount / 100
                                  ).toLocaleString('en-NP', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </p>
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-gray-800 pt-2 text-[10px] sm:text-xs">
                                <span className="text-gray-500">
                                  Date
                                </span>

                                <span className="text-right text-gray-300">
                                  {new Date(transaction.createdAt).toLocaleDateString('en-IN')}
                                </span>

                                {isOrderEarning && transaction.order && (
                                  <>
                                    <span className="text-gray-500">
                                      Food Amount
                                    </span>

                                    <span className="text-right text-gray-300">
                                      NPR {(transaction.order.foodCost / 100).toLocaleString('en-NP', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </span>

                                    <span className="text-gray-500">
                                      Commission
                                    </span>

                                    <span className="text-right text-gray-300">
                                      NPR {(transaction.order.platformFee / 100).toLocaleString('en-NP', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </span>

                                    <span className="text-gray-500">
                                      Seller Earning
                                    </span>

                                    <span className="text-right font-black text-white">
                                      NPR {(transaction.amount / 100).toLocaleString('en-NP', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
                      <button
                        type="button"
                        disabled={statementLoading || statementPage <= 1}
                        onClick={() => loadSellerStatement(statementPage - 1)}
                        className="rounded-md border border-gray-700 px-3 py-1.5 text-[10px] font-black text-gray-300 transition hover:bg-white/5 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
                      >
                        Previous
                      </button>

                      <p className="text-[10px] font-black text-gray-500 sm:text-xs">
                        Page {statementPage} of {statementTotalPages}
                      </p>

                      <button
                        type="button"
                        disabled={
                          statementLoading ||
                          !statementHasNextPage ||
                          statementPage >= statementTotalPages
                        }
                        onClick={() => loadSellerStatement(statementPage + 1)}
                        className="rounded-md border border-gray-700 px-3 py-1.5 text-[10px] font-black text-gray-300 transition hover:bg-white/5 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
  </>

  );
}

export default SellerAccount;
