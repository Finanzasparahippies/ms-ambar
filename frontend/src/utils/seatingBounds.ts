export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface TransformState {
  x: number;
  y: number;
  scale: number;
}

export interface SeatLike {
  x: number;
  y: number;
}

export interface ElementLike {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/**
 * Calculates the bounding box containing all seats and map elements.
 * Returns default bounds centered at origin if no elements exist.
 */
export function calculateLayoutBounds(
  seats: SeatLike[] = [],
  elements: ElementLike[] = [],
  seatPadding = 20
): LayoutBounds {
  if ((!seats || seats.length === 0) && (!elements || elements.length === 0)) {
    return {
      minX: -300,
      minY: -200,
      maxX: 300,
      maxY: 200,
      width: 600,
      height: 400,
      centerX: 0,
      centerY: 0
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Evaluate seats
  seats.forEach(s => {
    if (typeof s.x === 'number' && !isNaN(s.x) && typeof s.y === 'number' && !isNaN(s.y)) {
      minX = Math.min(minX, s.x - seatPadding);
      maxX = Math.max(maxX, s.x + seatPadding);
      minY = Math.min(minY, s.y - seatPadding);
      maxY = Math.max(maxY, s.y + seatPadding);
    }
  });

  // Evaluate map elements
  elements.forEach(el => {
    if (typeof el.x === 'number' && !isNaN(el.x) && typeof el.y === 'number' && !isNaN(el.y)) {
      const halfW = (el.w || 100) / 2 + seatPadding;
      const halfH = (el.h || 100) / 2 + seatPadding;
      minX = Math.min(minX, el.x - halfW);
      maxX = Math.max(maxX, el.x + halfW);
      minY = Math.min(minY, el.y - halfH);
      maxY = Math.max(maxY, el.y + halfH);
    }
  });

  // Fallback if numbers were invalid
  if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
    return {
      minX: -300,
      minY: -200,
      maxX: 300,
      maxY: 200,
      width: 600,
      height: 400,
      centerX: 0,
      centerY: 0
    };
  }

  const width = Math.max(50, maxX - minX);
  const height = Math.max(50, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX,
    centerY
  };
}

/**
 * Calculates optimal scale and translation (x, y) to fit layout bounds cleanly within container.
 */
export function calculateFitTransform(
  bounds: LayoutBounds,
  containerWidth: number,
  containerHeight: number,
  padding = 40
): TransformState {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, scale: 0.42 };
  }

  // Large screens (Desktop >= 768px): target 42% scale (0.42)
  // Small screens (Mobile < 768px): target 33% scale (0.33)
  const isDesktop = containerWidth >= 768;
  const targetDefaultScale = isDesktop ? 0.42 : 0.33;

  const availW = Math.max(50, containerWidth - padding * 2);
  const availH = Math.max(50, containerHeight - padding * 2);

  const scaleX = availW / bounds.width;
  const scaleY = availH / bounds.height;
  
  // Calculate fit scale bounded to target scale (0.42 desktop / 0.33 mobile)
  const fitScale = Math.max(0.15, Math.min(Math.min(scaleX, scaleY), targetDefaultScale));

  // Center layout in canvas container
  const x = (containerWidth / 2) - (bounds.centerX * fitScale);
  const y = (containerHeight / 2) - (bounds.centerY * fitScale);

  return { x, y, scale: fitScale };
}

/**
 * Clamps scale and pan (x, y) coordinates so the event layout stays within the viewport.
 * Prevents the user from panning far away into empty canvas void.
 */
export function clampTransform(
  nextTransform: TransformState,
  bounds: LayoutBounds,
  containerWidth: number,
  containerHeight: number,
  fitScale: number,
  margin = 80
): TransformState {
  // 1. Clamp scale
  const minScale = Math.max(0.1, fitScale * 0.45);
  const maxScale = Math.max(3.0, fitScale * 4.0);
  const scale = Math.max(minScale, Math.min(nextTransform.scale, maxScale));

  if (containerWidth <= 0 || containerHeight <= 0) {
    return { x: nextTransform.x, y: nextTransform.y, scale };
  }

  // Calculate layout coordinates scaled on screen
  const scaledMinX = bounds.minX * scale;
  const scaledMaxX = bounds.maxX * scale;
  const scaledMinY = bounds.minY * scale;
  const scaledMaxY = bounds.maxY * scale;

  const scaledWidth = bounds.width * scale;
  const scaledHeight = bounds.height * scale;

  let minPanX: number;
  let maxPanX: number;

  if (scaledWidth <= containerWidth - margin * 2) {
    // Layout fits inside screen width: keep it within center region
    const centerFitX = (containerWidth / 2) - (bounds.centerX * scale);
    const slackX = Math.max(20, (containerWidth - scaledWidth) / 3);
    minPanX = centerFitX - slackX;
    maxPanX = centerFitX + slackX;
  } else {
    // Layout larger than screen width: clamp so edges don't disappear past margin
    minPanX = containerWidth - margin - scaledMaxX;
    maxPanX = margin - scaledMinX;
  }

  let minPanY: number;
  let maxPanY: number;

  if (scaledHeight <= containerHeight - margin * 2) {
    // Layout fits inside screen height: keep it within center region
    const centerFitY = (containerHeight / 2) - (bounds.centerY * scale);
    const slackY = Math.max(20, (containerHeight - scaledHeight) / 3);
    minPanY = centerFitY - slackY;
    maxPanY = centerFitY + slackY;
  } else {
    // Layout larger than screen height: clamp so edges don't disappear past margin
    minPanY = containerHeight - margin - scaledMaxY;
    maxPanY = margin - scaledMinY;
  }

  const x = Math.max(minPanX, Math.min(nextTransform.x, maxPanX));
  const y = Math.max(minPanY, Math.min(nextTransform.y, maxPanY));

  return { x, y, scale };
}
