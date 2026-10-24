import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Registro from './Registro';
import {
  obtenerCategorias,
  obtenerCuentasFinancieras,
  obtenerMovimientos,
  obtenerTransferencias
} from '../services/api';

jest.mock('../services/api', () => ({
  obtenerCategorias: jest.fn(),
  obtenerCuentasFinancieras: jest.fn(),
  obtenerMovimientos: jest.fn(),
  obtenerTransferencias: jest.fn(),
  guardarMovimiento: jest.fn(),
  actualizarMovimiento: jest.fn(),
  eliminarMovimiento: jest.fn()
}));

describe('Registro', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    obtenerCategorias.mockResolvedValue({ categorias: [] });
    obtenerCuentasFinancieras.mockResolvedValue({ cuentas: [] });
    obtenerTransferencias.mockResolvedValue({ transferencias: [] });
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

    await waitFor(() => expect(screen.queryByText('Pago')).not.toBeInTheDocument());
    expect(screen.getByText('HISTORIAL · 1 REGISTROS')).toBeInTheDocument();
    expect(screen.getByLabelText('Totales de movimientos filtrados')).toHaveTextContent('42');
  });

  test('allows exporting transfer-only records and requests the full transfer history', async () => {
    obtenerMovimientos.mockResolvedValue({ movimientos: [] });
    obtenerTransferencias.mockResolvedValue({
      transferencias: [{
        id: 'transfer-1',
        date: '2026-10-18T12:00:00.000Z',
        amount: 25,
        description: 'Ahorro',
        fromFinancialAccount: { name: 'Efectivo' },
        toFinancialAccount: { name: 'Banco' }
      }]
    });
    const createObjectURL = jest.fn(() => 'blob:csv');
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;

    render(<Registro />);

    const exportButton = await screen.findByRole('button', { name: '↓ Exportar CSV' });
    await waitFor(() => expect(exportButton).toBeEnabled());
    expect(obtenerTransferencias).toHaveBeenCalledWith({ completo: true });
    fireEvent.click(exportButton);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

    URL.createObjectURL = originalCreateObjectURL;
  });
});
