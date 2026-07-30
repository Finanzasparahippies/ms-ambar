import {
  calculateLayoutBounds,
  calculateFitTransform,
  clampTransform
} from '../utils/seatingBounds';

describe('seatingBounds utility unit tests', () => {
  const sampleSeats = [
    { x: 100, y: 100 },
    { x: 500, y: 300 }
  ];

  const sampleElements = [
    { x: 300, y: 200, w: 200, h: 100 }
  ];

  test('calculateLayoutBounds correctly identifies boundaries of seats and elements', () => {
    const bounds = calculateLayoutBounds(sampleSeats, sampleElements, 20);

    // Seats: x from 100-20=80 to 500+20=520
    // Elements: x=300 w=200 -> x from 200-20=180 to 400+20=420
    // Overall minX=80, maxX=520
    expect(bounds.minX).toBe(80);
    expect(bounds.maxX).toBe(520);
    expect(bounds.width).toBe(440);

    // Seats y: 100-20=80 to 300+20=320
    // Elements y=200 h=100 -> 150-20=130 to 250+20=270
    // Overall minY=80, maxY=320
    expect(bounds.minY).toBe(80);
    expect(bounds.maxY).toBe(320);
    expect(bounds.height).toBe(240);

    expect(bounds.centerX).toBe((80 + 520) / 2);
    expect(bounds.centerY).toBe((80 + 320) / 2);
  });

  test('calculateLayoutBounds handles empty or null seats gracefully', () => {
    const bounds = calculateLayoutBounds([], []);
    expect(bounds.width).toBe(600);
    expect(bounds.height).toBe(400);
    expect(bounds.centerX).toBe(0);
    expect(bounds.centerY).toBe(0);
  });

  test('calculateFitTransform calculates centered transform within container', () => {
    const bounds = calculateLayoutBounds(sampleSeats, sampleElements, 20);
    const fit = calculateFitTransform(bounds, 1000, 800, 50);

    expect(fit.scale).toBeGreaterThan(0.5);
    expect(fit.scale).toBeLessThan(2.5);

    // Layout center on screen should equal container center (500, 400)
    const screenCenterX = fit.x + bounds.centerX * fit.scale;
    const screenCenterY = fit.y + bounds.centerY * fit.scale;

    expect(Math.round(screenCenterX)).toBe(500);
    expect(Math.round(screenCenterY)).toBe(400);
  });

  test('clampTransform restricts out-of-bounds panning and zoom limits', () => {
    const bounds = calculateLayoutBounds(sampleSeats, sampleElements, 20);
    const fit = calculateFitTransform(bounds, 1000, 800, 50);

    // Try extreme pan to the right (+9999) and left (-9999)
    const crazyFarRight = clampTransform({ x: 9999, y: 0, scale: fit.scale }, bounds, 1000, 800, fit.scale);
    expect(crazyFarRight.x).toBeLessThan(9999);

    const crazyFarLeft = clampTransform({ x: -9999, y: 0, scale: fit.scale }, bounds, 1000, 800, fit.scale);
    expect(crazyFarLeft.x).toBeGreaterThan(-9999);

    // Try zooming out below min scale
    const crazyTinyScale = clampTransform({ x: 0, y: 0, scale: 0.001 }, bounds, 1000, 800, fit.scale);
    expect(crazyTinyScale.scale).toBeGreaterThanOrEqual(fit.scale * 0.4);

    // Try zooming in above max scale
    const crazyHugeScale = clampTransform({ x: 0, y: 0, scale: 999 }, bounds, 1000, 800, fit.scale);
    expect(crazyHugeScale.scale).toBeLessThanOrEqual(fit.scale * 4.5);
  });
});
