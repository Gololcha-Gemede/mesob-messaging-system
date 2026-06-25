export default function PaginationRow({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="pagination-row">
      <button
        type="button"
        className="secondary-btn"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button
        type="button"
        className="secondary-btn"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Next
      </button>
    </div>
  );
}
