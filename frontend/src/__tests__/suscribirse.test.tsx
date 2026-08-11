import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  test('renders the newsletter subscription form correctly', async () => {
    await act(async () => {
      render(<Suscribirse />);
    });

    expect(screen.getByText('Ambar te escribe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tu Nombre')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tu Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suscribirse/i })).toBeInTheDocument();
  });

  test('renders the success screen immediately if email exists in localStorage on mount', async () => {
    localStorage.setItem('ms_ambar_subscriber_email', 'fan@example.com');
    
    await act(async () => {
      render(<Suscribirse />);
    });

    expect(screen.getByText(/¡Suscripción Completa!/i)).toBeInTheDocument();
    expect(screen.getByText(/Frecuencia Sintonizada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar Ms Ambar' })).toBeInTheDocument();
  });

  test('submits form successfully and transitions to success view', async () => {
    const user = userEvent.setup();
    let resolvePost: any;
    const postPromise = new Promise((resolve) => { resolvePost = resolve; });
    mockedApi.post.mockImplementationOnce(() => postPromise as any);

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    await user.type(nameInput, 'Juan');
    await user.type(emailInput, 'juan@example.com');

    await act(async () => {
      await user.click(submitButton);
    });

    expect(screen.getByText(/Sintonizando.../i)).toBeInTheDocument();

    await act(async () => {
      resolvePost({ data: { message: 'Ok' } });
    });

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(1);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/blog/subscribers/',
        { email: 'juan@example.com', name: 'Juan', turnstile_token: '' }
      );
      expect(screen.getByText(/¡Suscripción Completa!/i)).toBeInTheDocument();
      expect(screen.getByText(/Frecuencia Sintonizada/i)).toBeInTheDocument();
      expect(screen.getByText(/SINTONIZACIÓN/i)).toBeInTheDocument();
      expect(screen.getByText(/Te has suscrito con éxito al Newsletter de Ms Ambar./i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBe('juan@example.com');
  });

  test('honeypot field website_hp has correct accessibility attributes tabIndex="-1" and aria-hidden="true"', async () => {
    await act(async () => {
      render(<Suscribirse />);
    });

    const honeypotInput = document.querySelector('input[name="website_hp"]');
    expect(honeypotInput).toBeInTheDocument();
    expect(honeypotInput).toHaveAttribute('tabindex', '-1');
    expect(honeypotInput).toHaveAttribute('aria-hidden', 'true');
  });

  test('simulates success in UI and cancels API post if honeypot website_hp is filled by a bot', async () => {
    const user = userEvent.setup();

    render(<Suscribirse />);

    const nameInput = screen.getByPlaceholderText('Tu Nombre');
    const emailInput = screen.getByPlaceholderText('Tu Correo Electrónico');
    const honeypotInput = document.querySelector('input[name="website_hp"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Suscribirse/i });

    await user.type(nameInput, 'BotName');
    await user.type(emailInput, 'spammer@botdomain.com');
    await user.type(honeypotInput, 'http://spam-link.com');

    await act(async () => {
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/¡Suscripción Completa!/i)).toBeInTheDocument();
    });

    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBe('spammer@botdomain.com');
  });

  test('interprets 400 / already exists backend errors as success (already subscribed)', async () => {
    const user = userEvent.setup();
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

    await user.type(nameInput, 'Luis');
    await user.type(emailInput, 'luis@example.com');

    await act(async () => {
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/¡Suscripción Completa!/i)).toBeInTheDocument();
      expect(screen.getByText(/Suscripción confirmada. Acceso concedido./i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBe('luis@example.com');
  });

  test('displays Toast notification on generic error', async () => {
    const user = userEvent.setup();
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

    await user.type(nameInput, 'María');
    await user.type(emailInput, 'maria@example.com');

    await act(async () => {
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/FRECUENCIA INCOMPATIBLE/i)).toBeInTheDocument();
      expect(screen.getByText(/Error interno del servidor./i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/¡Suscripción Completa!/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('ms_ambar_subscriber_email')).toBeNull();
  });
});