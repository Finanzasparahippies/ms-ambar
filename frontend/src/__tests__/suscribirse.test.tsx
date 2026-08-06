import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Suscribirse from '../pages/suscribirse';
import api from '../lib/api';

// Mock ../lib/api
jest.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

// Mock next/head
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>;
    },
  };
});

/**
 * Flexible text matcher helper to locate fragmented text across DOM nodes
 */
const createTextMatcher = (expectedText: string) => (content: string, element: Element | null): boolean => {
  if (!element) return false;
  const hasText = (el: Element | null) => el?.textContent?.toLowerCase().includes(expectedText.toLowerCase()) ?? false;
  const elementHasText = hasText(element);
  const childrenDontHaveText = Array.from(element?.children || []).every(child => !hasText(child));
  return elementHasText && childrenDontHaveText;
};

describe('Suscribirse Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders the newsletter subscription form correctly', () => {
    render(<Suscribirse />);

    expect(screen.getByText('Ambar te escribe')).toBeInTheDocument();
    expect(screen.getByText(createTextMatcher('Deja tu correo aquí y recibe el newsletter escrito por Ms. Ambar'))).toBeInTheDocument();

    expect(screen.getByPlaceholderText('Tu Nombre')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tu Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suscribirse/i })).toBeInTheDocument();
  });

  test('renders the success screen immediately if email exists in localStorage on mount', () => {
    localStorage.setItem('ms_ambar_subscriber_email', 'fan@example.com');
    render(<Suscribirse />);

    expect(screen.getByText(createTextMatcher('¡Suscripción Completa!'))).toBeInTheDocument();
    expect(screen.getByText(createTextMatcher('Frecuencia Sintonizada'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar Ms Ambar' })).toBeInTheDocument();
  });

  test('submits form successfully and transitions to success view', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { message: 'Ok' } });

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Juan' } });
      fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(1);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/blog/subscribers/',
        { email: 'juan@example.com', name: 'Juan' }
      );
    });

    await waitFor(() => {
      expect(screen.getByText(createTextMatcher('¡Suscripción Completa!'))).toBeInTheDocument();
    });

    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBe('juan@example.com');
  });

  test('interprets 400 / already exists backend errors as success (already subscribed)', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          email: ['Este correo ya existe o ya está registrado.']
        }
      }
    });

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Luis' } });
      fireEvent.change(emailInput, { target: { value: 'luis@example.com' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(createTextMatcher('¡Suscripción Completa!'))).toBeInTheDocument();
    });

    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBe('luis@example.com');
  });

  test('displays Toast notification on generic error', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          email: ['Error interno del servidor.']
        }
      }
    });

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'María' } });
      fireEvent.change(emailInput, { target: { value: 'maria@example.com' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(createTextMatcher('FRECUENCIA INCOMPATIBLE'))).toBeInTheDocument();
      expect(screen.getByText(createTextMatcher('Error interno del servidor.'))).toBeInTheDocument();
    });

    expect(screen.queryByText(createTextMatcher('¡Suscripción Completa!'))).not.toBeInTheDocument();
    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBeNull();
  });
});
