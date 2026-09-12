"use server";

import { requireSession } from "@/lib/require-session";


import {
  getStockValuation, getSkuMargins, getDeadStock, getSeasonality, getFyExport,
} from "@/lib/analytics-db";
import { getMakeVsBuy } from "@/lib/jobwork-db";
import { getKarigarWages } from "@/lib/production-db";
import {
  StockValuation, SkuMargin, DeadStockLine, AgeingBucket, SeasonMonth, FyExportRow, toCsv,
} from "@/lib/analytics-logic";
import { MakeVsBuyLine } from "@/lib/jobwork-types";
import { KarigarWage } from "@/lib/production-types";

export interface AnalyticsPageData {
  valuation: StockValuation;
  margins: SkuMargin[];
  deadStock: { lines: DeadStockLine[]; raw_ageing: AgeingBucket[]; fg_ageing: AgeingBucket[] };
  seasonality: SeasonMonth[];
  makeVsBuy: MakeVsBuyLine[];
  wages: KarigarWage[];
  fyExport: { rows: FyExportRow[]; financial_year: string };
}

export async function fetchAnalyticsAction(): Promise<AnalyticsPageData> {
  await requireSession();
  const [valuation, margins, deadStock, seasonality, makeVsBuy, wages, fyExport] =
    await Promise.all([
      getStockValuation(), getSkuMargins(), getDeadStock(), getSeasonality(),
      getMakeVsBuy(), getKarigarWages(), getFyExport(),
    ]);

  return { valuation, margins, deadStock, seasonality, makeVsBuy, wages, fyExport };
}

/** CSV the owner can hand straight to the accountant. */
export async function fyExportCsvAction(): Promise<{ csv: string; filename: string }> {
  await requireSession();
  const { rows, financial_year } = await getFyExport();
  return {
    csv: toCsv(rows, financial_year),
    filename: `loknath-sofa-center-FY${financial_year}.csv`,
  };
}
