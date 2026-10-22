import React from 'react';
import { render, screen, within } from '@testing-library/react';
import Dashboard from './Dashboard';
import { obtenerDashboard } from '../services/api';

jest.mock('../services/api', () => ({
  obtenerDashboard: jest.fn()
}));

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    obtenerDashboard.mockImplementation(async (periodo) => ({
      exito: true,
      resumen: periodo?.fechaInicio
        ? { balanceTotal: 200, totalIngresos: 300, totalGastos: 100 }
        : { balanceTotal: 200, totalIngresos: 500, totalGastos: 300 },
      resumenCuentas: {
        cuentas: [
          { id: 'account-1', name: 'Principal', type: 'BANCO', saldo: 600, initialBalance: 600, deuda: 0, esCredito: false },
          { id: 'account-2', name: 'Tarjeta', type: 'CREDITO', saldo: 50, initialBalance: 50, deuda: 50, esCredito: true }
        ],
        totalDisponible: 600,
        patrimonioNeto: 550
      },
      gastosPorCategoria: [],
      ultimosMovimientos: []
    }));
  });

  test('shows personalized greeting and API-backed weekly cashflow', async () => {
    render(<Dashboard userName="Ana María" onNavigate={jest.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByText('Saldo del mes').closest('article')).toHaveTextContent('750');
    expect(screen.getByText(/Saldo inicial:/)).toHaveTextContent('550');
    expect(screen.getByText('Patrimonio neto').closest('div')).toHaveTextContent('550');
    const flujoSemanal = await screen.findByRole('region', { name: 'Flujo de efectivo de los últimos 7 días' });
    await within(flujoSemanal).findByText('Ingresos');

    expect(flujoSemanal).toHaveTextContent('300');
    expect(flujoSemanal).toHaveTextContent('100');
    expect(obtenerDashboard).toHaveBeenCalledWith(expect.objectContaining({
      fechaInicio: expect.any(String),
      fechaFin: expect.any(String),
      incluirTodos: true
    }));
  });
});
