import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CartProvider, useCart } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const mockProduct = {
  id: 201,
  name: 'Playera Ms Ambar Tour',
  slug: 'playera-tour',
  description: 'Playera algodón negra',
  price: 500,
  stock: 10,
  image: 'https://example.com/playera.jpg',
  category: { id: 1, name: 'Merch' },
  is_active: true,
  requires_shipping: true,
};

const TestCartComponent: React.FC = () => {
  const { addToCart, openCart, financials, shippingRate, requiresShipping } = useCart();

  return (
    <div>
      <button onClick={() => addToCart(mockProduct, 1)}>Agregar Playera</button>
      <button onClick={openCart}>Abrir Carrito</button>
      <div data-testid="requires-shipping">{requiresShipping ? 'yes' : 'no'}</div>
      <div data-testid="shipping-cost">{financials.shipping_cost === null ? 'null' : financials.shipping_cost}</div>
      <div data-testid="total-amount">{financials.total}</div>
      <CartDrawer />
    </div>
  );
};

describe('Cart Financials & Shipping State Machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedApi.get.mockResolvedValue({ data: { default_packaging_type: 'box' } });
  });

  test('does NOT add fallback shipping cost prematurely when cart has items requiring shipping', () => {
    render(
      <CartProvider>
        <TestCartComponent />
      </CartProvider>
    );

    // Initial: empty
    expect(screen.getByTestId('requires-shipping')).toHaveTextContent('no');
    expect(screen.getByTestId('shipping-cost')).toHaveTextContent('0');

    // Add item
    fireEvent.click(screen.getByText('Agregar Playera'));

    expect(screen.getByTestId('requires-shipping')).toHaveTextContent('yes');
    // shipping_cost MUST be null before quote and selection
    expect(screen.getByTestId('shipping-cost')).toHaveTextContent('null');
    // Total must be subtotal only ($500), NO fallback $150 added!
    expect(screen.getByTestId('total-amount')).toHaveTextContent('500');
  });

  test('displays "Por calcular" and prompts to enter shipping address in cart footer', async () => {
    render(
      <CartProvider>
        <TestCartComponent />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Agregar Playera'));
    fireEvent.click(screen.getByText('Abrir Carrito'));

    expect(screen.getByText('Por calcular')).toBeInTheDocument();
    expect(screen.getByText('Ingresar dirección de envío')).toBeInTheDocument();
  });
});
