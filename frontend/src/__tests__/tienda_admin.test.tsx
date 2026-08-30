import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import TiendaPage from '../pages/tienda';
import { ProductCard } from '../components/ProductCard';
import ImageOptimizerWidget from '../components/ImageOptimizerWidget';

jest.mock('axios');
jest.mock('sweetalert2');
jest.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
  }
}));

import api from '../lib/api';
const mockedApi = api as jest.Mocked<typeof api>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Tienda Page Admin & Image Optimizer Tests', () => {
  const mockProducts = [
    {
      id: 101,
      name: 'Vinilo Edición Especial',
      slug: 'vinilo-edicion-especial',
      description: 'Vinilo 180g',
      price: 750,
      stock: 10,
      image: 'https://cloudinary.com/vinilo.webp',
      category: { id: 1, name: 'Música' },
      category_name: 'Música',
      is_active: true
    },
    {
      id: 102,
      name: 'Playera Oficial Punk',
      slug: 'playera-oficial-punk',
      description: 'Playera algodón',
      price: 450,
      stock: 5,
      image: 'https://cloudinary.com/playera.webp',
      category: { id: 2, name: 'Ropa' },
      category_name: 'Ropa',
      is_active: true
    }
  ];

  const mockCategories = [
    { id: 1, name: 'Música', slug: 'musica' },
    { id: 2, name: 'Ropa', slug: 'ropa' }
  ];

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/shop/products/') {
        return Promise.resolve({ data: mockProducts });
      }
      if (url === '/shop/categories/') {
        return Promise.resolve({ data: mockCategories });
      }
      return Promise.resolve({ data: {} });
    });
  });

  test('Muestra botones de administración en /tienda cuando el usuario es administrador', async () => {
    // Simular token JWT de staff
    const staffPayload = { user_id: 1, is_staff: true, exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `header.${btoa(JSON.stringify(staffPayload))}.signature`;
    localStorage.setItem('token', fakeToken);

    await act(async () => {
      render(<TiendaPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Agregar Producto/i)).toBeInTheDocument();
      expect(screen.getByText(/Optimizar Imágenes/i)).toBeInTheDocument();
    });
  });

  test('ProductCard renderiza controles de edición y eliminación cuando isAdmin=true', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onAddToCart = jest.fn();

    render(
      <ProductCard
        product={mockProducts[0] as any}
        onAddToCart={onAddToCart}
        isAdmin={true}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const editBtn = screen.getByLabelText(/Editar Producto/i);
    const deleteBtn = screen.getByLabelText(/Eliminar Producto/i);

    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockProducts[0]);

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockProducts[0]);
  });

  test('ImageOptimizerWidget deshabilita el botón de cancelar durante el procesamiento y muestra feedback granular', async () => {
    const onCancel = jest.fn();
    mockedAxios.post.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              data: {
                processed_count: 1,
                total_files: 1,
                total_original_bytes: 1000,
                total_optimized_bytes: 500,
                total_saved_bytes: 500,
                reduction_percent: 50,
                results: [
                  {
                    filename: 'test.png',
                    status: 'success',
                    original_size: 1000,
                    optimized_size: 500,
                    saved_bytes: 500,
                    reduction_percent: 50,
                    url: 'https://cloudinary.com/test.webp'
                  }
                ]
              }
            }),
          100
        )
      )
    );

    const { container } = render(<ImageOptimizerWidget onCancel={onCancel} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dummyFile = new File(['dummy content'], 'test.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [dummyFile] } });
    });

    const submitBtn = screen.getByRole('button', { name: /Optimizar y Procesar/i });
    expect(submitBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Validar que el botón cerrar esté deshabilitado durante el proceso
    const closeBtn = screen.getByTitle(/Procesamiento en curso/i);
    expect(closeBtn).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/Resultado de la Optimización/i)).toBeInTheDocument();
    });
  });
});
