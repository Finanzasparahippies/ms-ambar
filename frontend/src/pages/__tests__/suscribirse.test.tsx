import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Suscribirse from '../suscribirse';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
    mockedAxios.post.mockResolvedValueOnce({ data: { message: 'Ok' } });

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    fireEvent.change(nameInput, { target: { value: 'Juan' } });
    fireEvent.change(emailInput, { target: { value: 'juan@example.com' } });
    fireEvent.click(submitButton);

    // Should show loading text
    expect(screen.getByText('Sintonizando...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/blog/subscribers/'),
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
    mockedAxios.post.mockRejectedValueOnce({
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
    mockedAxios.post.mockRejectedValueOnce({
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
