"use server";

import { requireSession } from "@/lib/require-session";


import { revalidatePath } from "next/cache";
import {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deactivateMaterial,
  getMaterialCategories,
  getUoms,
  getMaterialBatches,
  addMaterialBatch,
  getProducts,
  createProduct,
  getBoms,
  getBomLines,
  createBom,
  explodeBom,
} from "@/lib/erp-db";
import {
  Material,
  MaterialInput,
  BatchInput,
  MaterialBatch,
  MaterialCategory,
  Uom,
  Product,
  Bom,
  BomLine,
  BomInput,
  ExplodedRequirement,
} from "@/lib/erp-types";

export interface MaterialsPageData {
  materials: Material[];
  categories: MaterialCategory[];
  uoms: Uom[];
}

export async function fetchMaterialsAction(
  search?: string,
  type?: string
): Promise<MaterialsPageData> {
  await requireSession();
  const [materials, categories, uoms] = await Promise.all([
    getMaterials(search, type),
    getMaterialCategories(),
    getUoms(),
  ]);
  return { materials, categories, uoms };
}

export async function fetchMaterialBatchesAction(
  materialId: number
): Promise<{ material: Material | null; batches: MaterialBatch[] }> {
  await requireSession();
  const [material, batches] = await Promise.all([
    getMaterialById(materialId),
    getMaterialBatches(materialId),
  ]);
  return { material, batches };
}

export async function saveMaterialAction(
  input: MaterialInput,
  id?: number
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (!input.code.trim()) return { success: false, error: "Material code is required." };
    if (!input.name.trim()) return { success: false, error: "Material name is required." };
    if (input.purchase_to_stock_factor <= 0 || input.stock_to_consumption_factor <= 0) {
      return { success: false, error: "UOM conversion factors must be greater than zero." };
    }

    if (id) await updateMaterial(id, input);
    else await createMaterial(input);

    revalidatePath("/materials");
    return { success: true };
  } catch (err) {
    console.error("Failed to save material:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save material" };
  }
}

export async function addBatchAction(
  materialId: number,
  input: BatchInput
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (!input.batch_no.trim()) return { success: false, error: "Batch number is required." };
    if (input.quantity <= 0) return { success: false, error: "Quantity must be greater than zero." };

    await addMaterialBatch(materialId, input);
    revalidatePath("/materials");
    return { success: true };
  } catch (err) {
    console.error("Failed to add batch:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to add batch" };
  }
}

export async function deactivateMaterialAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    await deactivateMaterial(id);
    revalidatePath("/materials");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove material" };
  }
}

export interface BomPageData {
  boms: Bom[];
  products: Product[];
  materials: Material[];
}

export async function fetchBomPageDataAction(): Promise<BomPageData> {
  await requireSession();
  const [boms, products, materials] = await Promise.all([getBoms(), getProducts(), getMaterials()]);
  return { boms, products, materials };
}

export async function fetchBomLinesAction(bomId: number): Promise<BomLine[]> {
  await requireSession();
  return getBomLines(bomId);
}

export async function explodeBomAction(
  productId: number,
  quantity: number
): Promise<ExplodedRequirement[]> {
  await requireSession();
  return explodeBom(productId, quantity);
}

export async function saveBomAction(input: BomInput): Promise<{ success: boolean; error?: string }> {
  await requireSession();
  try {
    if (!input.product_id) return { success: false, error: "Select a product for this BOM." };
    if (!input.lines.length) return { success: false, error: "Add at least one BOM line." };

    await createBom(input);
    revalidatePath("/bom");
    return { success: true };
  } catch (err) {
    console.error("Failed to save BOM:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save BOM" };
  }
}

export async function createProductAction(input: {
  code: string;
  name: string;
  product_type: string;
  category?: string | null;
  uom: string;
}): Promise<{ success: boolean; product?: Product; error?: string }> {
  await requireSession();
  try {
    if (!input.code.trim() || !input.name.trim()) {
      return { success: false, error: "Product code and name are required." };
    }
    const product = await createProduct(input);
    revalidatePath("/bom");
    return { success: true, product };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create product" };
  }
}
