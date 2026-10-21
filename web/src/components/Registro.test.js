import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Registro from './Registro';
import {
  obtenerCategorias,
  obtenerCuentasFinancieras,
  obtenerMovimientos
} from '../services/api';

jest.mock('../services/api', () => ({
  obtenerCategorias: jest.fn(),
  obtenerCuentasFinancieras: jest.fn(),
  obtenerMovimientos: jest.fn(),
  guardarMovimiento: jest.fn(),
  actualizarMovimiento: jest.fn(),
  eliminarMovimiento: jest.fn()
}));

describe('Registro', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    obtenerCategorias.mockResolvedValue({ categorias: [] });
    obtenerCuentasFinancieras.mockResolvedValue({ cuentas: [] });
    obtenerMovimientos.mockResolvedValue({
      movimientos: [
        {
          id: 'expense-1',
          type: 'GASTO',
          amount: 42,
          date: '2026-10-18T12:00:00.000Z',
          description: 'Compra semanal',
          category: { name: 'Supermercado', icon: '🛒' },
          financialAccount: { name: 'Cuenta principal' }
        },
        {
          id: 'income-1',
          type: 'INGRESO',
          amount: 100,
          date: '2026-10-17T12:00:00.000Z',
          description: 'Pago',
          category: { name: 'Salario', icon: '💼' },
          financialAccount: { name: 'Cuenta principal' }
        }
      ]
    });
  });

  test('filters API-backed movements and recalculates period totals', async () => {
    render(<Registro />);

    expect(await screen.findByText('Compra semanal')).toBeInTheDocument();
    expect(screen.getByText('Pago')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'supermercado' } });

    await waitFor(() => {
      expect(screen.getByText('Compra semanal')).toBeInTheDocument();
      expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    });
    expect(screen.getByText('HISTORIAL · 1 REGISTROS')).toBeInTheDocument();
    expect(screen.getByLabelText('Totales de movimientos filtrados')).toHaveTextContent('42');
  });
});
