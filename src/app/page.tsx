"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { Header } from "@/components/Header";
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
  getDbStatus,
  addItemAction,
  restockItemAction,
  editItemAction,
  deleteItemAction,
} from "@/app/actions";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; provider: string }>({
    connected: false,
    provider: "Checking...",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [restockItemTarget, setRestockItemTarget] = useState<InventoryItem | null>(null);
  const [historyItemTarget, setHistoryItemTarget] = useState<InventoryItem | null>(null);
  const [editItemTarget, setEditItemTarget] = useState<InventoryItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<InventoryItem | null>(null);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Load Inventory Data
  const loadInventory = async () => {
    try {
      const [invData, dbData] = await Promise.all([
        fetchInventoryAction(search, selectedCategory),
        getDbStatus(),
      ]);
      setItems(invData.items);
      setSummary(invData.summary);
      setDbStatus(dbData);
    } catch (error) {
      console.error("Failed to load inventory:", error);
      showToast("Error loading inventory data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [search, selectedCategory]);

  // Auto-adapt default viewMode based on screen size on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 1024) {
        setViewMode("cards");
      } else {
        setViewMode("table");
      }
    }
  }, []);

  // Client-side sorting for responsive instant feedback
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

  // Handlers for Modals & Actions
  const handleAddItem = async (input: AddItemInput) => {
    const res = await addItemAction(input);
    if (!res.success) {
      throw new Error(res.error || "Failed to add item");
    }
    showToast(`Added "${input.name}" to inventory!`);
    await loadInventory();
  };

  const handleRestockItem = async (itemId: number, input: RestockInput) => {
    const res = await restockItemAction(itemId, input);
    if (!res.success) {
      throw new Error(res.error || "Failed to restock item");
    }
    showToast(`Restocked +${input.quantity_added} units successfully!`);
    await loadInventory();
  };

  const handleEditItem = async (itemId: number, input: EditItemInput) => {
    const res = await editItemAction(itemId, input);
    if (!res.success) {
      throw new Error(res.error || "Failed to update item");
    }
    showToast(`Updated "${input.name}" details.`);
    await loadInventory();
  };

  const handleDeleteItem = async (itemId: number) => {
    const res = await deleteItemAction(itemId);
    if (!res.success) {
      throw new Error(res.error || "Failed to delete item");
    }
    showToast("Furniture item deleted from inventory.");
    await loadInventory();
  };

  return (
    <main className="app-container">
      {/* 1. Header with Brand, DB Status, and Add Item CTA */}
      <Header
        onAddItemClick={() => setIsAddOpen(true)}
        dbStatus={dbStatus}
      />

      {/* 2. Top-level KPI Metrics */}
      <StatsOverview summary={summary} />

      {/* 3. Search, Category Pills, Sorting, and View Switcher */}
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

      {/* 4. Main Inventory Listing (Table or Card View) */}
      <section className="inventory-section" aria-label="Furniture Items List">
        <div className="section-header-row">
          <h2 className="section-title">
            <span>Furniture Inventory</span>
            <span className="section-count-badge">
              {sortedItems.length} {sortedItems.length === 1 ? "Item" : "Items"}
            </span>
          </h2>
          <p className="section-subtitle">
            Showing latest batch restock costs and live valuation
          </p>
        </div>

        {isLoading ? (
          <div className="main-loading-state">
            <Loader2 size={36} className="main-spinner" />
            <p>Loading furniture stock...</p>
          </div>
        ) : viewMode === "table" ? (
          <div className="desktop-table-container">
            <InventoryTable
              items={sortedItems}
              onRestockClick={(item) => setRestockItemTarget(item)}
              onHistoryClick={(item) => setHistoryItemTarget(item)}
              onEditClick={(item) => setEditItemTarget(item)}
              onDeleteClick={(item) => setDeleteItemTarget(item)}
            />
          </div>
        ) : (
          <InventoryCardList
            items={sortedItems}
            onRestockClick={(item) => setRestockItemTarget(item)}
            onHistoryClick={(item) => setHistoryItemTarget(item)}
            onEditClick={(item) => setEditItemTarget(item)}
            onDeleteClick={(item) => setDeleteItemTarget(item)}
          />
        )}
      </section>

      {/* Toast Notification Notification Pill */}
      {toast && (
        <div
          className={`toast-pill ${
            toast.type === "error" ? "toast-error" : "toast-success"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modals */}
      <AddItemModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAddItem}
      />

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
          margin-top: 1rem;
        }

        .section-header-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          font-size: 1.35rem;
        }

        .section-count-badge {
          font-family: var(--font-body);
          font-size: 0.775rem;
          font-weight: 600;
          color: var(--primary);
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 0.15rem 0.6rem;
          border-radius: var(--radius-full);
        }

        .section-subtitle {
          font-size: 0.85rem;
          color: var(--text-secondary);
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

        /* Toast notifications */
        .toast-pill {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.85rem 1.25rem;
          border-radius: var(--radius-full);
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
          background: #064e3b;
          border: 1px solid #059669;
          color: #a7f3d0;
        }

        .toast-error {
          background: #7f1d1d;
          border: 1px solid #dc2626;
          color: #fecaca;
        }
      `}</style>
    </main>
  );
}
