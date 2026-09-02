import { useCallback, useState } from 'react';

export default function useSellerStatement({ API_BASE }) {
  const [statementTransactions, setStatementTransactions] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [statementPage, setStatementPage] = useState(1);
  const [statementTotalPages, setStatementTotalPages] = useState(1);
  const [statementHasNextPage, setStatementHasNextPage] = useState(false);

  const loadSellerStatement = useCallback(async (
    page = 1,
    fromDate = statementFromDate,
    toDate = statementToDate
  ) => {
    setStatementLoading(true);
    setStatementError('');

    try {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      const params = new URLSearchParams({
        limit: '20',
        page: String(safePage)
      });

      if (fromDate) {
        params.set('from', fromDate);
      }

      if (toDate) {
        params.set('to', toDate);
      }

      const response = await fetch(
        `${API_BASE}/api/seller/store/statement?${params.toString()}`,
        {
          credentials: 'include'
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            data.error ||
            'Failed to load statement.'
        );
      }

      const transactions = Array.isArray(data.statement?.transactions)
        ? data.statement.transactions
        : [];

      const pagination = data.statement?.pagination || {};

      setStatementTransactions(transactions);
      setStatementPage(
        Number.isInteger(pagination.page) && pagination.page > 0
          ? pagination.page
          : safePage
      );

      setStatementTotalPages(
        Number.isInteger(pagination.totalPages) && pagination.totalPages >= 1
          ? pagination.totalPages
          : 1
      );

      setStatementHasNextPage(
        pagination.hasNextPage === true
      );
    } catch (error) {
      setStatementTransactions([]);
      setStatementPage(1);
      setStatementTotalPages(1);
      setStatementHasNextPage(false);

      setStatementError(
        error instanceof Error
          ? error.message
          : 'Failed to load statement.'
      );
    } finally {
      setStatementLoading(false);
    }
  }, [API_BASE, statementFromDate, statementToDate]);

  return {
    statementTransactions,
    statementLoading,
    statementError,
    setStatementError,
    statementFromDate,
    setStatementFromDate,
    statementToDate,
    setStatementToDate,
    statementPage,
    setStatementPage,
    statementTotalPages,
    statementHasNextPage,
    loadSellerStatement
  };
}
