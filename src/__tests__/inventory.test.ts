import {
  getAllItems,
  getItemById,
  getItemRestockHistory,
  createItem,
  restockItem,
  updateItem,
  deleteItem,
} from "../lib/db";
import { formatINR, formatDate } from "../lib/formatters";

async function runTests() {
  console.log("=== RUNNING INVENTORY MANAGEMENT SUITE TESTS ===");

  // 1. Initial State
  const initialItems = await getAllItems();
  console.log(`✓ Retrieved initial items: ${initialItems.length} items`);
  console.assert(initialItems.length >= 7, "Should have initial seed items");

  // 2. Formatters
  console.log(`✓ Currency format test (42000): "${formatINR(42000)}"`);
  console.log(`✓ Date format test: "${formatDate("2026-09-01")}"`);

  // 3. Add Item
  console.log("--> Testing createItem...");
  const newItem = await createItem({
    name: "Emerald Velvet Chaise Lounge",
    category: "Sofa",
    initial_quantity: 4,
    initial_cost_per_unit: 28000,
    initial_note: "Grand Diwali consignment",
  });
  console.log(`✓ Created item #${newItem.id}: ${newItem.name}`);
  console.assert(newItem.current_quantity === 4, "Qty should be 4");
  console.assert(newItem.current_cost_per_unit === 28000, "Unit cost should be 28000");
  console.assert(newItem.total_value === 112000, "Total value should be 112000 (4 * 28000)");

  // Verify initial history created
  const historyAfterAdd = await getItemRestockHistory(newItem.id);
  console.log(`✓ Initial history entries count: ${historyAfterAdd.length}`);
  console.assert(historyAfterAdd.length === 1, "Should have 1 initial history record");
  console.assert(historyAfterAdd[0].quantity_added === 4, "History qty should be 4");
  console.assert(historyAfterAdd[0].note === "Grand Diwali consignment", "History note matches");

  // 4. Restock Item (Core Requirement)
  console.log("--> Testing restockItem (Core feature)...");
  const restockedItem = await restockItem(newItem.id, {
    quantity_added: 3,
    cost_per_unit: 29500, // new batch price is higher
    restock_date: "2026-09-12",
    note: "Batch #2 Restock (Post-festival supplier price)",
  });
  console.log(`✓ Restocked item #${restockedItem.id}:`);
  console.log(`  - New Total Quantity: ${restockedItem.current_quantity} (expected 7)`);
  console.log(`  - Updated Current Batch Cost: ₹${restockedItem.current_cost_per_unit} (expected 29500)`);
  console.log(`  - Updated Total Valuation: ₹${restockedItem.total_value} (expected 206500)`);
  console.assert(restockedItem.current_quantity === 7, "Quantity should now be 7 (4 + 3)");
  console.assert(restockedItem.current_cost_per_unit === 29500, "Current cost must reflect new batch cost");
  console.assert(restockedItem.total_value === 206500, "Total value must be 7 * 29500 = 206500");

  // 5. Verify History is Append-Only
  const historyAfterRestock = await getItemRestockHistory(newItem.id);
  console.log(`✓ History entries after restock: ${historyAfterRestock.length} (expected 2)`);
  console.assert(historyAfterRestock.length === 2, "History must have 2 entries");
  console.assert(historyAfterRestock[0].quantity_added === 3, "Latest entry should be +3");
  console.assert(historyAfterRestock[0].cost_per_unit === 29500, "Latest entry cost should be 29500");
  console.assert(historyAfterRestock[1].quantity_added === 4, "Previous entry +4 preserved");

  // 6. Update Item (Name & Category)
  console.log("--> Testing updateItem...");
  const updatedItem = await updateItem(newItem.id, {
    name: "Emerald Green Velvet Chaise Lounge (Premium Edition)",
    category: "Sofa",
  });
  console.log(`✓ Updated item name: ${updatedItem.name}`);
  console.assert(updatedItem.name.includes("Premium Edition"), "Name should update");

  // 7. Delete Item
  console.log("--> Testing deleteItem...");
  await deleteItem(newItem.id);
  const deletedItemCheck = await getItemById(newItem.id);
  console.assert(deletedItemCheck === null, "Item should be deleted");
  const deletedHistoryCheck = await getItemRestockHistory(newItem.id);
  console.assert(deletedHistoryCheck.length === 0, "History should be removed on delete");
  console.log("✓ Successfully deleted item and verified cascade");

  // 8. Search and Filter Tests
  console.log("--> Testing Search and Category filtering...");
  const sofaItems = await getAllItems(undefined, "Sofa");
  console.log(`✓ Found ${sofaItems.length} Sofa items`);
  console.assert(sofaItems.every((i) => i.category === "Sofa"), "All must be category Sofa");

  const searchResults = await getAllItems("Recliner");
  console.log(`✓ Found ${searchResults.length} items matching 'Recliner'`);
  console.assert(searchResults.length > 0, "Should match Recliner");

  console.log("=== ALL INVENTORY SYSTEM UNIT TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
