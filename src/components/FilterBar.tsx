"use client";

import { Search, X, LayoutGrid, Table as TableIcon, ArrowUpDown } from "lucide-react";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  availableCategories: string[];
  sortBy: string;
  onSortChange: (sort: string) => void;
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
}

export function FilterBar({
  search,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  availableCategories,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: FilterBarProps) {
  const allCategories = ["All", ...availableCategories.filter((c) => c !== "All")];

  return (
    <div className="filterbar-container">
      {/* Search & Sort Controls Row */}
      <div className="filterbar-top-row">
        {/* Search Bar */}
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search sofas, recliners, dining sets..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            id="input-inventory-search"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="clear-search-btn"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Sort & View Mode Switches */}
        <div className="filterbar-actions">
          {/* Sort Dropdown */}
          <div className="sort-wrapper">
            <ArrowUpDown size={15} className="sort-icon" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="sort-select"
              aria-label="Sort inventory items"
              id="select-inventory-sort"
            >
              <option value="recent">Recently Restocked</option>
              <option value="stock-asc">Stock: Low to High</option>
              <option value="stock-desc">Stock: High to Low</option>
              <option value="value-desc">Highest Valuation</option>
              <option value="name-asc">Name: A to Z</option>
            </select>
          </div>

          {/* View Mode Toggle (Cards vs Table) */}
          <div className="view-toggle" role="group" aria-label="View layout switch">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => onViewModeChange("table")}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon size={17} />
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => onViewModeChange("cards")}
              title="Card grid view"
              aria-label="Card grid view"
            >
              <LayoutGrid size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills (Horizontal Scrollable) */}
      <div className="categories-scroll" role="tablist" aria-label="Filter by furniture category">
        {allCategories.map((cat) => {
          const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={isActive}
              className={`category-pill ${isActive ? "category-pill-active" : ""}`}
              onClick={() => onCategorySelect(cat)}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .filterbar-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .filterbar-top-row {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        @media (min-width: 768px) {
          .filterbar-top-row {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          max-width: 100%;
        }

        @media (min-width: 768px) {
          .search-wrapper {
            max-width: 460px;
          }
        }

        .search-input {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 0.95rem;
          padding: 0.65rem 2.5rem 0.65rem 2.6rem;
          min-height: 46px; /* Touch target */
          outline: none;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .search-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--border-focus);
        }

        .search-icon {
          position: absolute;
          left: 0.95rem;
          color: var(--text-secondary);
          pointer-events: none;
        }

        .clear-search-btn {
          position: absolute;
          right: 0.75rem;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--bg-surface-elevated);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .clear-search-btn:hover {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
        }

        .filterbar-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          justify-content: space-between;
        }

        @media (min-width: 768px) {
          .filterbar-actions {
            justify-content: flex-end;
          }
        }

        .sort-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
        }

        @media (min-width: 768px) {
          .sort-wrapper {
            flex: initial;
          }
        }

        .sort-icon {
          position: absolute;
          left: 0.85rem;
          color: var(--text-secondary);
          pointer-events: none;
        }

        .sort-select {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 0.875rem;
          padding: 0.65rem 1rem 0.65rem 2.25rem;
          min-height: 46px;
          outline: none;
          cursor: pointer;
          transition: border-color var(--transition-fast);
        }

        .sort-select:focus {
          border-color: var(--primary);
        }

        .view-toggle {
          display: inline-flex;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 3px;
        }

        .view-toggle-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .view-toggle-btn.active {
          background: var(--bg-surface-elevated);
          color: var(--primary);
        }

        .view-toggle-btn:hover:not(.active) {
          color: var(--text-primary);
        }

        /* Category Scrolling Pills */
        .categories-scroll {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.35rem;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; /* Firefox */
        }

        .categories-scroll::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }

        .category-pill {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-family: var(--font-heading);
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.5rem 1.05rem;
          min-height: 40px;
          border-radius: var(--radius-full);
          white-space: nowrap;
          cursor: pointer;
          transition: all var(--transition-fast);
          user-select: none;
        }

        .category-pill:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .category-pill-active {
          background: var(--primary);
          color: var(--text-inverse);
          border-color: var(--primary);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
