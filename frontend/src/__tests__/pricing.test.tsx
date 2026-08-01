import React from 'react';
import '@testing-library/jest-dom';

// Copy of calculateTotalWithFee mirror helper logic used in comprar-boletos.tsx
const STRIPE_PCT_FEE = 0.036;   // 3.6%
const STRIPE_FLAT_FEE = 3.00;   // $3.00 MXN

const calculateTotalWithFee = (baseAmount: number): { base_price: number; service_fee: number; total: number } => {
  if (baseAmount <= 0) return { base_price: 0, service_fee: 0, total: 0 };
  const base_price = Math.round(baseAmount * 100) / 100;
  const total = Math.round(((base_price + STRIPE_FLAT_FEE) / (1 - STRIPE_PCT_FEE)) * 100) / 100;
  const service_fee = Math.round((total - base_price) * 100) / 100;
  return {
    base_price,
    service_fee,
    total,
  };
};

const getDynamicPrice = (event: any, baseAmount: number, nowOverride?: Date) => {
  if (!event || !baseAmount || baseAmount <= 0) return baseAmount || 0;
  if (event.enable_dynamic_pricing === false || !event.date) return baseAmount;
  const eventDate = new Date(event.date);
  const now = nowOverride || new Date();
  const eventMonthIdx = eventDate.getFullYear() * 12 + eventDate.getMonth();
  const currMonthIdx = now.getFullYear() * 12 + now.getMonth();
  const monthsDiff = eventMonthIdx - currMonthIdx;

  if (monthsDiff >= 2) {
    return baseAmount;
  }

  const increments = 2 - Math.max(0, monthsDiff);
  const increment = Number(event.monthly_price_increment ?? 50);
  const increase = increments * increment;

  return Math.max(baseAmount, baseAmount + increase);
};

describe('Pricing and Stripe Fee Mirror Unit Tests (Frontend)', () => {
  test('debe calcular la comisión de recargo (Gross-Up) garantizando el pago neto base ($1,000 MXN -> $1,040.46 MXN)', () => {
    const res = calculateTotalWithFee(1000);
    expect(res.base_price).toBe(1000);
    expect(res.total).toBe(1040.46);
    expect(res.service_fee).toBe(40.46);
  });

  test('debe calcular la comisión Gross-Up para boleto de $500 MXN ($500 MXN -> $521.78 MXN)', () => {
    const res = calculateTotalWithFee(500);
    expect(res.base_price).toBe(500);
    expect(res.total).toBe(521.78);
    expect(res.service_fee).toBe(21.78);
  });

  test('debe calcular correctamente la comisión Gross-Up al adquirir pases Meet & Greet (2 pases de $500 = $1,000 base -> $1,040.46 total)', () => {
    const mgQuantity = 2;
    const mgPrice = 500;
    const baseTotal = mgQuantity * mgPrice; // $1,000 MXN
    const res = calculateTotalWithFee(baseTotal);

    expect(res.base_price).toBe(1000);
    expect(res.service_fee).toBe(40.46);
    expect(res.total).toBe(1040.46);
  });

  test('debe calcular la comisión Gross-Up al combinar boleto de concierto con Upgrade M&G ($1,000 boleto + $500 upgrade = $1,500 base -> $1,559.13 total)', () => {
    const seatPrice = 1000;
    const mgUpgradePrice = 500;
    const baseTotal = seatPrice + mgUpgradePrice; // $1,500 MXN
    const res = calculateTotalWithFee(baseTotal);

    expect(res.base_price).toBe(1500);
    expect(res.service_fee).toBe(59.13);
    expect(res.total).toBe(1559.13);
  });

  test('debe aplicar exactamente máximo 2 incrementos dinámicos en los meses previa y durante el evento (Evento en Octubre)', () => {
    const event = {
      date: '2026-10-15T20:00:00Z',
      enable_dynamic_pricing: true,
      monthly_price_increment: 50,
    };
    const basePrice = 400;

    // Mayo (5 meses antes): 0 aumentos -> 400
    expect(getDynamicPrice(event, basePrice, new Date('2026-05-10T12:00:00Z'))).toBe(400);

    // Julio (3 meses antes): 0 aumentos -> 400
    expect(getDynamicPrice(event, basePrice, new Date('2026-07-10T12:00:00Z'))).toBe(400);

    // Agosto (2 meses antes): 0 aumentos -> 400 (se mantiene base)
    expect(getDynamicPrice(event, basePrice, new Date('2026-08-10T12:00:00Z'))).toBe(400);

    // Septiembre (1 mes antes - Transición Ago->Sep): 1er incremento (+$50) -> 450
    expect(getDynamicPrice(event, basePrice, new Date('2026-09-10T12:00:00Z'))).toBe(450);

    // Octubre (Mes del evento - Transición Sep->Oct): 2do incremento (+$100) -> 500
    expect(getDynamicPrice(event, basePrice, new Date('2026-10-05T12:00:00Z'))).toBe(500);
  });
});
