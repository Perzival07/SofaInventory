"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { StatsOverview } from "@/components/StatsOverview";
import { FilterBar } from "@/components/FilterBar";
import { InventoryTable } from "@/components/InventoryTable";
import { InventoryCardList } from "@/components/InventoryCardList";
import { AddItemModal } from "@/components/AddItemModal";
import { RestockModal } from "@/components/RestockModal";
import { HistoryModal } from "@/components/HistoryModal";
import { EditItemModal } from "@/components/EditItemModal";
import { DeleteItemModal } from "@/components/DeleteItemModal";
import {
  InventoryItem,
  InventorySummary,
  AddItemInput,
  RestockInput,
  EditItemInput,
} from "@/lib/types";
import {
  fetchInventoryAction,
  addItemAction,
  restockItemAction,
  editItemAction,
  deleteItemAction,
} from "@/app/actions";
import { CheckCircle2, AlertCircle, Loader2, AlertTriangle } from "lucide-react";

export default function InventoryDashboard() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalItems: 0,
    totalStockUnits: 0,
    totalInventoryValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categories: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showAttentionOnly, setShowAttentionOnly] = useState(false);

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [restockItemTarget, setRestockItemTarget] = useState<InventoryItem | null>(null);
  const [historyItemTarget, setHistoryItemTarget] = useState<InventoryItem | null>(null);
  const [editItemTarget, setEditItemTarget] = useState<InventoryItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<InventoryItem | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const invData = await fetchInventoryAction(search, selectedCategory);
      setItems(invData.items);
      setSummary(invData.summary);
    } catch (error) {
      console.error("Failed to load inventory:", error);
      showToast("Error loading inventory data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server whenever search/category change
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- window is unavailable during SSR render, so this can only run post-mount
      setViewMode(window.innerWidth < 1024 ? "cards" : "table");
    }
  }, []);

  const sortedItems = useMemo(() => {
    const list = [...items];
    switch (sortBy) {
      case "stock-asc":
        return list.sort((a, b) => a.current_quantity - b.current_quantity);
      case "stock-desc":
        return list.sort((a, b) => b.current_quantity - a.current_quantity);
      case "value-desc":
        return list.sort((a, b) => b.total_value - a.total_value);
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "recent":
      default:
        return list.sort(
          (a, b) =>
            new Date(b.last_restocked_at).getTime() - new Date(a.last_restocked_at).getTime()
        );
    }
  }, [items, sortBy]);

  const displayedItems = useMemo(
    () => (showAttentionOnly ? sortedItems.filter((i) => i.current_quantity <= 3) : sortedItems),
    [sortedItems, showAttentionOnly]
  );

  const attentionCount = summary.lowStockCount + summary.outOfStockCount;

  const handleAddItem = async (input: AddItemInput) => {
    const res = await addItemAction(input);
    if (!res.success) throw new Error(res.error || "Failed to add item");
    showToast(`Added "${input.name}" to inventory!`);
    await loadInventory();
  };

  const handleRestockItem = async (itemId: number, input: RestockInput) => {
    const res = await restockItemAction(itemId, input);
    if (!res.success) throw new Error(res.error || "Failed to restock item");
    showToast(`Restocked +${input.quantity_added} units successfully!`);
    await loadInventory();
  };

  const handleEditItem = async (itemId: number, input: EditItemInput) => {
    const res = await editItemAction(itemId, input);
    if (!res.success) throw new Error(res.error || "Failed to update item");
    showToast(`Updated "${input.name}" details.`);
    await loadInventory();
  };

  const handleDeleteItem = async (itemId: number) => {
    const res = await deleteItemAction(itemId);
    if (!res.success) throw new Error(res.error || "Failed to delete item");
    showToast("Furniture item deleted from inventory.");
    await loadInventory();
  };

  return (
    <AppShell
      title="Finished Goods"
      subtitle="Sellable stock with latest batch costs and live valuation"
      actionLabel="Add New Furniture"
      onAction={() => setIsAddOpen(true)}
    >
      <StatsOverview summary={summary} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        availableCategories={summary.categories}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <section className="inventory-section" aria-label="Furniture Items List">
        <div className="section-header-row">
          <h2 className="section-title">
            <span>Furniture Inventory</span>
            <span className="section-count-badge">
              {displayedItems.length} {displayedItems.length === 1 ? "Item" : "Items"}
            </span>
          </h2>

          <button
            type="button"
            className={`attention-toggle ${showAttentionOnly ? "attention-toggle-active" : ""}`}
            onClick={() => setShowAttentionOnly((v) => !v)}
            id="btn-toggle-attention"
          >
            <AlertTriangle size={15} />
            <span>Needs Attention</span>
            {attentionCount > 0 && <span className="attention-count">{attentionCount}</span>}
          </button>
        </div>

        {isLoading ? (
          <div className="main-loading-state">
            <Loader2 size={32} className="main-spinner" />
            <p>Loading furniture stock...</p>
          </div>
        ) : viewMode === "table" ? (
          <div className="desktop-table-container">
            <InventoryTable
              items={displayedItems}
              onRestockClick={setRestockItemTarget}
              onHistoryClick={setHistoryItemTarget}
              onEditClick={setEditItemTarget}
              onDeleteClick={setDeleteItemTarget}
            />
          </div>
        ) : (
          <InventoryCardList
            items={displayedItems}
            onRestockClick={setRestockItemTarget}
            onHistoryClick={setHistoryItemTarget}
            onEditClick={setEditItemTarget}
            onDeleteClick={setDeleteItemTarget}
          />
        )}
      </section>

      {toast && (
        <div
          className={`toast-pill ${toast.type === "error" ? "toast-error" : "toast-success"}`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <AddItemModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSubmit={handleAddItem} />
      <RestockModal
        item={restockItemTarget}
        isOpen={Boolean(restockItemTarget)}
        onClose={() => setRestockItemTarget(null)}
        onSubmit={handleRestockItem}
      />
      <HistoryModal
        item={historyItemTarget}
        isOpen={Boolean(historyItemTarget)}
        onClose={() => setHistoryItemTarget(null)}
      />
      <EditItemModal
        item={editItemTarget}
        isOpen={Boolean(editItemTarget)}
        onClose={() => setEditItemTarget(null)}
        onSubmit={handleEditItem}
      />
      <DeleteItemModal
        item={deleteItemTarget}
        isOpen={Boolean(deleteItemTarget)}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleDeleteItem}
      />

      <style jsx>{`
        .inventory-section {
          margin-top: 0.25rem;
        }

        .section-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          font-size: 1.2rem;
        }

        .section-count-badge {
          font-family: var(--font-body);
          font-size: 0.775rem;
          font-weight: 600;
          color: var(--primary);
          background: var(--primary-soft);
          border: 1px solid var(--primary-soft-border);
          padding: 0.15rem 0.6rem;
          border-radius: var(--radius-full);
        }

        .attention-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.9rem;
          min-height: 40px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .attention-toggle:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .attention-toggle-active {
          background: var(--status-out-stock-bg);
          border-color: var(--status-out-stock-border);
          color: var(--status-out-stock-text);
          font-weight: 600;
        }

        .attention-count {
          background: var(--status-out-stock-text);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 700;
          min-width: 20px;
          height: 20px;
          padding: 0 0.35rem;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .main-loading-state {
          padding: 5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
        }

        .main-spinner {
          animation: spin 1s linear infinite;
          color: var(--primary);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .toast-pill {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md);
          font-family: var(--font-heading);
          font-size: 0.9rem;
          font-weight: 600;
          box-shadow: var(--shadow-lg);
          animation: fadeIn 200ms ease-out;
        }

        @media (max-width: 600px) {
          .toast-pill {
            bottom: 1rem;
            left: 1rem;
            right: 1rem;
            justify-content: center;
          }
        }

        .toast-success {
          background: #15803d;
          color: #ffffff;
        }

        .toast-error {
          background: #b91c1c;
          color: #ffffff;
        }
      `}</style>
    </AppShell>
  );
}
