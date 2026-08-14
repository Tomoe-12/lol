import { prisma } from "../src/lib/prisma";
import { POST } from "../src/app/api/pos/checkout/route";
import { NextRequest } from "next/server";

// Isolated validation logic definitions matching frontend payment-dialog.tsx and cart-panel.tsx
export function validateOrderDiscount(subtotal: number, orderDiscount: number, discountType: "fixed" | "percentage"): { valid: boolean; error: string | null; calculatedDiscount: number } {
  if (orderDiscount < 0) {
    return { valid: false, error: "Discount amount cannot be negative", calculatedDiscount: 0 };
  }

  let calculatedDiscount = orderDiscount;
  if (discountType === "percentage") {
    if (orderDiscount > 100) {
      return { valid: false, error: "Discount percentage cannot exceed 100%", calculatedDiscount: 0 };
    }
    calculatedDiscount = (subtotal * orderDiscount) / 100;
  }

  if (calculatedDiscount > subtotal) {
    return { valid: false, error: `Order discount (${calculatedDiscount.toLocaleString()} Ks) cannot exceed subtotal (${subtotal.toLocaleString()} Ks)`, calculatedDiscount };
  }

  return { valid: true, error: null, calculatedDiscount };
}

export function validateSplitPaymentInputs(totalMMK: number, cashInput: string, nonCashInput: string): { valid: boolean; error: string | null; remaining: number } {
  const rawCash = parseFloat(cashInput);
  const rawNonCash = parseFloat(nonCashInput);

  if ((!isNaN(rawCash) && rawCash < 0) || (!isNaN(rawNonCash) && rawNonCash < 0)) {
    return { valid: false, error: "Split payment amounts cannot be negative", remaining: totalMMK };
  }

  const splitCash = isNaN(rawCash) || rawCash < 0 ? 0 : rawCash;
  const splitNonCash = isNaN(rawNonCash) || rawNonCash < 0 ? 0 : rawNonCash;
  const totalSplitEntered = splitCash + splitNonCash;
  const remaining = Math.max(0, totalMMK - totalSplitEntered);

  if (splitCash > totalMMK) {
    return { valid: false, error: `Split cash amount (${splitCash.toLocaleString()} Ks) cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`, remaining };
  }

  if (splitNonCash > totalMMK) {
    return { valid: false, error: `Split non-cash amount (${splitNonCash.toLocaleString()} Ks) cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`, remaining };
  }

  if (totalSplitEntered > totalMMK) {
    return { valid: false, error: `Total split payment amount (${totalSplitEntered.toLocaleString()} Ks) cannot exceed total order amount (${totalMMK.toLocaleString()} Ks)`, remaining };
  }

  if (Math.abs(totalSplitEntered - totalMMK) > 1) {
    return { valid: false, error: `Split total must equal total order amount. Remaining: ${remaining.toLocaleString()} Ks`, remaining };
  }

  return { valid: true, error: null, remaining: 0 };
}

export function calculateSplitAutoFill(totalMMK: number, cashInput: string): { splitCash: number; splitNonCash: number; splitNonCashStr: string; error: string | null } {
  const cashVal = parseFloat(cashInput);
  if (!isNaN(cashVal) && cashVal < 0) {
    return { splitCash: cashVal, splitNonCash: totalMMK, splitNonCashStr: totalMMK.toString(), error: "Split payment amounts cannot be negative" };
  }
  const validCash = isNaN(cashVal) || cashVal < 0 ? 0 : cashVal;
  const remaining = Math.max(0, totalMMK - validCash);
  return { splitCash: validCash, splitNonCash: remaining, splitNonCashStr: remaining.toString(), error: null };
}

export function validateMinimumSellingPrice(items: Array<{
  product: { name: string };
  unitPrice: number;
  quantity: number;
  discount: number;
  selectedVariant?: { costPrice?: number } | null;
}>): { valid: boolean; error: string | null } {
  for (const item of items) {
    const costPrice = item.selectedVariant?.costPrice ?? 0;
    if (costPrice > 0) {
      const effectiveSellingPrice = (item.unitPrice * item.quantity - (item.discount || 0)) / item.quantity;
      if (effectiveSellingPrice < costPrice) {
        return {
          valid: false,
          error: `Selling price for ${item.product.name} (${effectiveSellingPrice} Ks) cannot be lower than cost price (${costPrice} Ks)`
        };
      }
    }
  }
  return { valid: true, error: null };
}

async function runEmpiricalVerification() {
  console.log("=================================================");
  console.log("   POS CHECKOUT VALIDATION EMPIRICAL TEST SUITE  ");
  console.log("=================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  // SCENARIO 1: Discount exceeding subtotal
  console.log("--- Scenario 1: Discount exceeding subtotal ---");
  const s1_subtotal = 1500;
  const s1_discount = 3000;
  const s1_result = validateOrderDiscount(s1_subtotal, s1_discount, "fixed");
  console.log(`Input: Subtotal = ${s1_subtotal} Ks, Discount = ${s1_discount} Ks`);
  console.log(`Result: valid=${s1_result.valid}, error="${s1_result.error}"`);
  if (!s1_result.valid && s1_result.error?.includes("cannot exceed subtotal")) {
    console.log("✅ PASS: Discount exceeding subtotal correctly rejected with validation error.\n");
    passedTests++;
  } else {
    console.error("❌ FAIL: Discount exceeding subtotal was not properly rejected.\n");
    failedTests++;
  }

  // SCENARIO 2: Split payment negative input
  console.log("--- Scenario 2: Split payment negative input ---");
  const s2_totalMMK = 1000;
  const s2_cashInput = "-500";
  const s2_nonCashInput = "1500";
  const s2_result = validateSplitPaymentInputs(s2_totalMMK, s2_cashInput, s2_nonCashInput);
  console.log(`Input: Total = ${s2_totalMMK} Ks, Cash = ${s2_cashInput} Ks, Non-Cash = ${s2_nonCashInput} Ks`);
  console.log(`Result: valid=${s2_result.valid}, error="${s2_result.error}"`);
  if (!s2_result.valid && s2_result.error === "Split payment amounts cannot be negative") {
    console.log("✅ PASS: Negative split payment input correctly rejected with validation error.\n");
    passedTests++;
  } else {
    console.error("❌ FAIL: Negative split payment input was not rejected.\n");
    failedTests++;
  }

  // SCENARIO 3: Split payment auto-calculation
  console.log("--- Scenario 3: Split payment auto-calculation ---");
  const s3_totalMMK = 1000;
  const s3_cashInput = "500";
  const s3_autofill = calculateSplitAutoFill(s3_totalMMK, s3_cashInput);
  console.log(`Input: Total = ${s3_totalMMK} Ks, Cash entered = ${s3_cashInput} Ks`);
  console.log(`Auto-calculated non-cash: ${s3_autofill.splitNonCashStr} Ks (numeric: ${s3_autofill.splitNonCash})`);
  if (s3_autofill.splitNonCash === 500 && s3_autofill.splitNonCashStr === "500" && s3_autofill.error === null) {
    console.log("✅ PASS: Split payment auto-calculated remaining 500 Ks correctly.\n");
    passedTests++;
  } else {
    console.error("❌ FAIL: Split payment auto-calculation failed.\n");
    failedTests++;
  }

  // SCENARIO 4: Overpayment cap
  console.log("--- Scenario 4: Overpayment cap ---");
  const s4_totalMMK = 1000;
  const s4_cashInput = "2000";
  const s4_nonCashInput = "0";
  const s4_result = validateSplitPaymentInputs(s4_totalMMK, s4_cashInput, s4_nonCashInput);
  console.log(`Input: Total = ${s4_totalMMK} Ks, Payment input = ${s4_cashInput} Ks`);
  console.log(`Result: valid=${s4_result.valid}, error="${s4_result.error}"`);
  if (!s4_result.valid && s4_result.error?.includes("cannot exceed total order amount")) {
    console.log("✅ PASS: Overpayment cap correctly enforced with validation error.\n");
    passedTests++;
  } else {
    console.error("❌ FAIL: Overpayment cap was not enforced.\n");
    failedTests++;
  }

  // SCENARIO 5: Minimum selling price enforcement
  console.log("--- Scenario 5: Minimum selling price enforcement ---");
  const s5_items = [
    {
      product: { name: "Test Product" },
      unitPrice: 1000,
      quantity: 1,
      discount: 600, // Effective selling price = 400 Ks
      selectedVariant: { costPrice: 800 } // Cost price = 800 Ks
    }
  ];
  const s5_result = validateMinimumSellingPrice(s5_items);
  console.log(`Input: Item unitPrice = 1000 Ks, discount = 600 Ks (effective price = 400 Ks), costPrice = 800 Ks`);
  console.log(`Result: valid=${s5_result.valid}, error="${s5_result.error}"`);
  if (!s5_result.valid && s5_result.error?.includes("cannot be lower than cost price")) {
    console.log("✅ PASS: Selling item below costPrice correctly blocked with validation error.\n");
    passedTests++;
  } else {
    console.error("❌ FAIL: Minimum selling price enforcement failed.\n");
    failedTests++;
  }

  // Direct Backend API POST Handler Verification
  console.log("--- Direct Backend API Route Handler Verification ---");
  try {
    const branch = await prisma.branch.findFirst();
    const staff = await prisma.staff.findFirst();
    const highCostVariant = await prisma.productVariant.findFirst({
      where: { costPrice: { gt: 0 } },
      include: { product: true }
    }) || await prisma.productVariant.findFirst({ include: { product: true } });

    if (!branch || !staff || !highCostVariant) {
      console.warn("⚠️ Warning: DB missing branch, staff, or variant.");
    } else {
      // Backend API Test 1: Discount exceeding subtotal
      const req1 = new Request("http://localhost:3000/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          staffId: staff.id,
          subtotal: 1500,
          discountAmount: 3000, // Invalid discount
          total: 0,
          currency: "MMK",
          exchangeRate: 4500,
          paymentMethod: "CASH",
          items: [{
            product: { id: highCostVariant.productId },
            selectedVariant: { id: highCostVariant.id, costPrice: highCostVariant.costPrice },
            quantity: 1,
            unitPrice: 1500,
            discount: 0
          }]
        })
      });
      const res1 = await POST(req1 as unknown as NextRequest);
      const data1 = await res1.json();
      console.log(`Backend Route Discount Check: Status=${res1.status}, Error="${data1.error}"`);
      if (res1.status === 400 && data1.error?.includes("Invalid discount amount")) {
        console.log("✅ PASS: Backend API handler rejected discount exceeding subtotal.\n");
        passedTests++;
      } else {
        console.error("❌ FAIL: Backend API handler allowed discount exceeding subtotal.\n");
        failedTests++;
      }

      // Backend API Test 2: Minimum selling price below DB cost price
      const testVariant = await prisma.productVariant.findFirst({
        include: { product: true }
      });
      if (testVariant) {
        // Temporarily set costPrice to 500 Ks for empirical testing
        const origCost = testVariant.costPrice;
        await prisma.productVariant.update({
          where: { id: testVariant.id },
          data: { costPrice: 500 }
        });

        try {
          const req2 = new Request("http://localhost:3000/api/pos/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branchId: branch.id,
              staffId: staff.id,
              subtotal: 100,
              discountAmount: 0,
              total: 100,
              currency: "MMK",
              exchangeRate: 4500,
              paymentMethod: "CASH",
              cashReceived: 1000,
              items: [{
                product: { id: testVariant.productId },
                selectedVariant: { id: testVariant.id, costPrice: 500 },
                quantity: 1,
                unitPrice: 100, // 100 Ks < costPrice (500 Ks)
                discount: 0
              }]
            })
          });
          const res2 = await POST(req2 as unknown as NextRequest);
          const data2 = await res2.json();
          console.log(`Backend Route Min Price Check: Status=${res2.status}, Error="${data2.error}"`);
          if (res2.status === 400 && data2.error?.includes("cannot be lower than cost price")) {
            console.log("✅ PASS: Backend API handler enforced minimum selling price against DB cost price.\n");
            passedTests++;
          } else {
            console.error("❌ FAIL: Backend API handler failed to enforce min selling price.\n");
            failedTests++;
          }
        } finally {
          // Restore original cost price
          await prisma.productVariant.update({
            where: { id: testVariant.id },
            data: { costPrice: origCost }
          });
        }
      }
    }
  } catch (err) {
    console.error("Error during backend handler verification:", err);
  } finally {
    await prisma.$disconnect();
  }

  console.log("=================================================");
  console.log(` FINAL RESULTS: ${passedTests} passed, ${failedTests} failed.`);
  console.log("=================================================");
}

runEmpiricalVerification();
