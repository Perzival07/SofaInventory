// =============================================================================
// Bilingual Dictionary: English & Bengali (বাংলা)
// Specially tailored for Barasat, North 24 Parganas, West Bengal
// =============================================================================

import { LanguageCode } from "./types";

export const DICTIONARY = {
  en: {
    // Header & Brand
    app_title: "The Sofa Studio & Furniture Co.",
    app_tagline: "Manufacturing, Outsourced Job Work & Retail ERP",
    location: "Barasat, North 24 Parganas, West Bengal",
    demo_mode: "In-Memory Demo Mode",
    db_connected: "Vercel Postgres (Neon) Connected",

    // Navigation Tabs
    tab_inventory: "Furniture Inventory & Stock",
    tab_retail: "Retail & Showroom",
    tab_production: "In-House WIP & Factory",
    tab_job_work: "Job Work (Vendor Stock)",
    tab_raw_material: "Raw Material Store",
    tab_turnover_tax: "Turnover & GST Settings",

    // Four Stock States
    state_raw_material: "Raw Material Store",
    state_in_house_wip: "In-House Factory WIP",
    state_stock_with_vendor: "Stock with Vendor (Our Asset)",
    state_finished_goods: "Finished Goods Stock",

    // Turnover Watchdog
    turnover_watchdog: "Turnover Watchdog",
    turnover_current_fy: "Current FY Turnover (PAN Aggregated)",
    threshold_limit: "GST Exemption Threshold",
    turnover_safe: "Within Safe Limit (< ₹30 Lakhs)",
    turnover_amber: "Amber Notice (Turnover crossed ₹30 Lakhs)",
    turnover_red: "Red Alert (Turnover crossed ₹35 Lakhs)",
    turnover_blocking: "BLOCKING ALERT (Turnover crossed ₹38 Lakhs - Register for GST Immediately)",
    other_pan_business: "Other Business Turnover on same PAN",
    projected_fy_turnover: "Projected Annual Run-Rate (Durga Puja Adjusted)",

    // Tax Strategy
    tax_status_unregistered: "Tax Regime: UNREGISTERED (Cash Memo / Bill of Supply)",
    tax_status_registered: "Tax Regime: REGISTERED (Statutory Tax Invoices with CGST/SGST/IGST)",
    switch_tax_regime: "Switch Tax Regime",
    transitional_credit: "Section 18(1)(a) Transitional Credit Report",
    download_report: "Download Audit Report",

    // Production & Karigars
    daily_production_log: "Daily Stage-wise Production Log",
    stage_cutting: "1. Wood & Ply Cutting",
    stage_frame: "2. Frame Assembly (কাঠের খাঁচা তৈরি)",
    stage_sanding: "3. Machine Sanding (সিরিশ পালিশ)",
    stage_foaming: "4. Foam & Spring Fitting (ফোম ফিটিং)",
    stage_upholstery: "5. Fabric Upholstery (কাপড় পরানো)",
    stage_polishing: "6. PU / Melamine Polish (বার্নিশ)",
    stage_fitting: "7. Hardware Fitting (কব্জা/হ্যান্ডেল)",
    stage_qc: "8. Quality Inspection (QC পরীক্ষা)",
    stage_packing: "9. Bubble Packing (প্যাকিং)",
    karigar_wages: "Karigar Piece-Rate Wages",

    // Job Work
    job_work_challan: "Job Work Delivery Challan",
    vendor_stock_notice: "Notice: Issued materials remain our legal asset until reconciled.",
    three_way_match: "3-Way Match (Order ↔ GRN ↔ Vendor Bill)",

    // Retail & Khata
    cash_memo: "Cash Memo / Bill of Supply",
    tax_invoice: "TAX INVOICE",
    khata_ledger: "Customer Khata / Udhaar Ledger",
    amount_paid: "Paid Amount",
    balance_due: "Balance Due (বাকি)",
    barasat_zones: "Barasat Delivery Zone",
    floor_surcharge: "Floor Surcharge (No Lift)",

    // Monsoon Mode
    monsoon_mode: "Monsoon Mode Active (উচ্চ আর্দ্রতা সতর্কতা)",
    monsoon_desc: "Timber moisture threshold raised to 15%. Extra 24h curing added for polish & adhesive.",

    // General
    add_item: "Add Item",
    restock: "Restock / Inward",
    history: "Audit Log",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
  },
  bn: {
    // Header & Brand
    app_title: "দ্য সোফা স্টুডিও অ্যান্ড ফার্নিচার কোং",
    app_tagline: "ফার্নিচার তৈরি, জব ওয়ার্ক এবং রিটেল ম্যানেজমেন্ট সিস্টেম",
    location: "বারাসাত, উত্তর ২৪ পরগণা, পশ্চিমবঙ্গ",
    demo_mode: "ইন-মেমোরি ডেমো মোড",
    db_connected: "ভার্সেল পোস্টগ্রেস ডাটাবেস সংযুক্ত",

    // Navigation Tabs
    tab_inventory: "ফার্নিচার স্টক ও ইনভেন্টরি",
    tab_retail: "শোরুম ও খুচরো বিক্রি",
    tab_production: "কারখানা ও উৎপাদন (WIP)",
    tab_job_work: "জব ওয়ার্ক (কারিগরদের স্টক)",
    tab_raw_material: "কাঁচামাল গোডাউন",
    tab_turnover_tax: "টার্নওভার ও জিএসটি সেটিংস",

    // Four Stock States
    state_raw_material: "কাঁচামাল গোডাউন",
    state_in_house_wip: "কারখানার কাজ (চলমান উৎপাদন)",
    state_stock_with_vendor: "বাইরের ভেন্ডারের কাছে মাল (আমাদের সম্পদ)",
    state_finished_goods: "তৈরি ফার্নিচার স্টক",

    // Turnover Watchdog
    turnover_watchdog: "টার্নওভার নজরদারি (Turnover Watchdog)",
    turnover_current_fy: "চলতি আর্থিক বছরের মোট টার্নওভার",
    threshold_limit: "জিএসটি ছাড়ের সীমা (₹৪০ লাখ)",
    turnover_safe: "নিরাপদ সীমায় আছে (< ₹৩০ লাখ)",
    turnover_amber: "সতর্কতা: টার্নওভার ₹৩০ লাখ ছাড়িয়েছে",
    turnover_red: "জরুরি সতর্কতা: টার্নওভার ₹৩৫ লাখ ছাড়িয়েছে",
    turnover_blocking: "চূড়ান্ত সতর্কতা: টার্নওভার ₹৩৮ লাখ ছাড়িয়েছে (অবিলম্বে জিএসটি নিন)",
    other_pan_business: "একই প্যান (PAN) কার্ডের অন্যান্য ব্যবসার টার্নওভার",
    projected_fy_turnover: "পূজা ও উৎসবের সম্ভাব্য বার্ষিক টার্নওভার",

    // Tax Strategy
    tax_status_unregistered: "ট্যাক্স স্ট্যাটাস: অনিবন্ধিত (ক্যাশ মেমো / বিল অফ সাপ্লাই)",
    tax_status_registered: "ট্যাক্স স্ট্যাটাস: জিএসটি নিবন্ধিত (ট্যাক্স ইনভয়েস - CGST/SGST)",
    switch_tax_regime: "ট্যাক্স নিয়ম পরিবর্তন করুন",
    transitional_credit: "সেকশন ১৮(১)(এ) ট্রানজিশনাল ইনপুট ক্রেডিট রিপোর্ট",
    download_report: "অডিট রিপোর্ট ডাউনলোড",

    // Production & Karigars
    daily_production_log: "দৈনিক পর্যায়ভিত্তিক কাজের হিসাব",
    stage_cutting: "১. কাঠ ও প্লাইউড কাটিং",
    stage_frame: "২. কাঠের খাঁচা তৈরি (Frame Assembly)",
    stage_sanding: "৩. সিরিশ পালিশ ও ফিনিশিং",
    stage_foaming: "৪. ফোম ও স্প্রিং ফিটিং",
    stage_upholstery: "৫. কুশন ও কাপড় পরানো",
    stage_polishing: "৬. পিইউ ও মেলামাইন বার্নিশ",
    stage_fitting: "৭. কব্জা ও হ্যান্ডেল ফিটিং",
    stage_qc: "৮. গুণমান পরীক্ষা (QC)",
    stage_packing: "৯. বাবল প্যাকিং",
    karigar_wages: "কারিগরদের মজুরি ও পিস-রেট হিসাব",

    // Job Work
    job_work_challan: "জব ওয়ার্ক ডেলিভারি চালান",
    vendor_stock_notice: "সতর্কতা: ভেন্ডারকে দেওয়া সমস্ত কাঁচামাল আমাদের আইনগত সম্পদ।",
    three_way_match: "থ্রি-ওয়ে ম্যাচ (অর্ডার ↔ চালান ↔ ভেন্ডার বিল)",

    // Retail & Khata
    cash_memo: "ক্যাশ মেমো / বিল অফ সাপ্লাই",
    tax_invoice: "ট্যাক্স ইনভয়েস (TAX INVOICE)",
    khata_ledger: "গ্রাহকদের খাতা / উধার খতিয়ান",
    amount_paid: "জমা টাকা",
    balance_due: "বাকি টাকা (উধার)",
    barasat_zones: "বারাসাত ডেলিভারি এলাকা",
    floor_surcharge: "সিঁড়ি দিয়ে তোলার অতিরিক্ত খরচ (লিফট নেই)",

    // Monsoon Mode
    monsoon_mode: "বর্ষাকালীন মোড চালু (উচ্চ আর্দ্রতা সতর্কতা)",
    monsoon_desc: "কাঠের ময়েশ্চার লিমিট ১৫% এবং বার্নিশ শুকানোর সময় বাড়ানো হয়েছে।",

    // General
    add_item: "নতুন আইটেম যোগ",
    restock: "স্টক ঢুকানো",
    history: "হিস্ট্রি ও লগ",
    edit: "সংশোধন",
    delete: "মুছে ফেলুন",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
  },
};

export function t(key: keyof typeof DICTIONARY["en"], lang: LanguageCode = "en"): string {
  return DICTIONARY[lang]?.[key] || DICTIONARY["en"][key] || key;
}
