import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('Suscribirse Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders the newsletter subscription form correctly', () => {
    render(<Suscribirse />);

    // Check title and descriptions
    expect(screen.getByText('Ambar te escribe')).toBeInTheDocument();
    expect(screen.getByText(/Deja tu correo aquí y recibe el newsletter escrito por Ms. Ambar/i)).toBeInTheDocument();

    // Check inputs and buttons
    expect(screen.getByPlaceholderText('Tu Nombre')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tu Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suscribirse/i })).toBeInTheDocument();
  });

  test('renders the success screen immediately if email exists in localStorage on mount', () => {
    localStorage.setItem('ms_ambar_subscriber_email', 'fan@example.com');
    render(<Suscribirse />);

    // Success screen indicators
    expect(screen.getByText('¡Suscripción Completa!')).toBeInTheDocument();
    expect(screen.getByText('Frecuencia Sintonizada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar Ms Ambar' })).toBeInTheDocument();
  });

  test('submits form successfully and transitions to success view', async () => {
    let resolvePost: any;
    const postPromise = new Promise((resolve) => { resolvePost = resolve; });
    mockedApi.post.mockReturnValueOnce(postPromise as any);

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    fireEvent.change(nameInput, { target: { value: 'Juan' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.click(submitButton);

    // Should show loading text while post is pending
    expect(screen.getByText('Sintonizando...')).toBeInTheDocument();

    // Resolve API promise
    resolvePost({ data: { message: 'Ok' } });

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(1);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/blog/subscribers/',
        { email: 'juan@example.com', name: 'Juan' }
      );
    });

    // Success view should be active
    await waitFor(() => {
      expect(screen.getByText('¡Suscripción Completa!')).toBeInTheDocument();
    });

    // Check localStorage setting
    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBe('juan@example.com');
  });

  test('interprets 400 / already exists backend errors as success (already subscribed)', async () => {
    // Mock API to fail with 400 status / "already exists"
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

    fireEvent.change(nameInput, { target: { value: 'Luis' } });
    fireEvent.change(emailInput, { target: { value: 'luis@example.com' } });
    fireEvent.click(submitButton);

    // Expecting transition to success because user is already subscribed
    await waitFor(() => {
      expect(screen.getByText('¡Suscripción Completa!')).toBeInTheDocument();
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

    fireEvent.change(nameInput, { target: { value: 'María' } });
    fireEvent.change(emailInput, { target: { value: 'maria@example.com' } });
    fireEvent.click(submitButton);

    // Wait for Toast error display
    await waitFor(() => {
      expect(screen.getByText('FRECUENCIA INCOMPATIBLE')).toBeInTheDocument();
      expect(screen.getByText('Error interno del servidor.')).toBeInTheDocument();
    });

    // Should NOT transition to success view
    expect(screen.queryByText('¡Suscripción Completa!')).not.toBeInTheDocument();
    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBeNull();
  });
});
