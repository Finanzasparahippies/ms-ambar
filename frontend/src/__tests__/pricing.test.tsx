import React from 'react';
import '@testing-library/jest-dom';

// Copy of calculateTotalWithFee mirror helper logic used in comprar-boletos.tsx
const EFFECTIVE_PCT_FEE = 0.04176;   // 3.6% base + 16% IVA
const EFFECTIVE_FLAT_FEE = 3.48;     // $3.00 base + 16% IVA

const calculateTotalWithFee = (baseAmount: number): { base_price: number; service_fee: number; total: number } => {
  if (baseAmount <= 0) return { base_price: 0, service_fee: 0, total: 0 };
  const base_price = Math.round(baseAmount * 100) / 100;
  const total = Math.round(((base_price + EFFECTIVE_FLAT_FEE) / (1 - EFFECTIVE_PCT_FEE)) * 100) / 100;
  const service_fee = Math.round((total - base_price) * 100) / 100;
  return {
    base_price,
    service_fee,
    total,
  };
};

const getDynamicPrice = (event: any, baseAmount: number) => {
  if (!event || !baseAmount || baseAmount <= 0) return baseAmount || 0;
  if (event.enable_dynamic_pricing === false || !event.date) return baseAmount;
  const eventDate = new Date(event.date);
  const now = new Date();
  const eventMonthIdx = eventDate.getFullYear() * 12 + eventDate.getMonth();
  const currMonthIdx = now.getFullYear() * 12 + now.getMonth();
  const monthsDiff = eventMonthIdx - currMonthIdx;

  if (monthsDiff > 3) {
    return baseAmount;
  }

  const monthsInLast3 = 3 - Math.max(0, monthsDiff);
  const increment = Number(event.monthly_price_increment ?? 50);
  const increase = monthsInLast3 * increment;

  return Math.max(baseAmount, baseAmount + increase);
};

describe('Pricing and Stripe Fee Mirror Unit Tests (Frontend)', () => {
  test('debe calcular la comisión de recargo (Gross-Up) garantizando el pago neto base ($1,000 MXN -> $1,047.21 MXN)', () => {
    const res = calculateTotalWithFee(1000);
    expect(res.base_price).toBe(1000);
    expect(res.total).toBe(1047.21);
    expect(res.service_fee).toBe(47.21);
  });

  test('debe calcular la comisión Gross-Up para boleto de $500 MXN ($500 MXN -> $525.42 MXN)', () => {
    const res = calculateTotalWithFee(500);
    expect(res.base_price).toBe(500);
    expect(res.total).toBe(525.42);
    expect(res.service_fee).toBe(25.42);
  });

  test('debe calcular la comisión Gross-Up exacta para caso real de $1,100 MXN base ($1,100 MXN -> $1,151.57 MXN)', () => {
    const res = calculateTotalWithFee(1100);
    expect(res.base_price).toBe(1100);
    expect(res.total).toBe(1151.57);
    expect(res.service_fee).toBe(51.57);
  });

  test('debe calcular la comisión Gross-Up al combinar boleto de concierto con Upgrade M&G ($1,000 boleto + $500 upgrade = $1,500 base -> $1,569.01 total)', () => {
    const seatPrice = 1000;
    const mgUpgradePrice = 500;
    const baseTotal = seatPrice + mgUpgradePrice; // $1,500 MXN
    const res = calculateTotalWithFee(baseTotal);

    expect(res.base_price).toBe(1500);
    expect(res.service_fee).toBe(69.01);
    expect(res.total).toBe(1569.01);
  });
});
