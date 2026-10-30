import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Registro from './Registro';
import {
  obtenerCategorias,
  obtenerCuentasFinancieras,
  obtenerMovimientos,
  obtenerTransferencias,
  actualizarMovimiento,
  guardarMovimiento
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
    obtenerCuentasFinancieras.mockResolvedValue({
      cuentas: [{ id: 'account-1', name: 'Cuenta principal', type: 'EFECTIVO' }]
    });
    obtenerTransferencias.mockResolvedValue({ transferencias: [] });
    obtenerMovimientos.mockResolvedValue({
      movimientos: [
        {
          id: 'expense-1',
          type: 'GASTO',
          amount: 42,
          date: '2026-10-18T12:00:00.000Z',
          financialAccountId: 'account-1',
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
    URL.revokeObjectURL = jest.fn();

    render(<Registro />);

    const exportButton = await screen.findByRole('button', { name: '↓ Exportar CSV' });
    await waitFor(() => expect(exportButton).toBeEnabled());
    expect(obtenerTransferencias).toHaveBeenCalledWith({ completo: true });
    fireEvent.click(exportButton);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

    URL.createObjectURL = originalCreateObjectURL;
  });

  test('loads and saves the selected date when editing a movement', async () => {
    obtenerCategorias.mockResolvedValue({
      categorias: [{ id: 'category-1', name: 'Supermercado', type: 'GASTO' }]
    });
    render(<Registro />);

    fireEvent.click(await screen.findByRole('button', { name: 'Editar movimiento Supermercado' }));

    const dateInput = screen.getByLabelText('Fecha');
    expect(dateInput).toHaveValue('2026-10-18');
    await waitFor(() => expect(screen.getByLabelText('Cuenta')).toHaveValue('account-1'));
    fireEvent.change(dateInput, { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() => expect(actualizarMovimiento).toHaveBeenCalledWith(
      'expense-1',
      expect.objectContaining({ date: '2026-10-12' })
    ));
  });

  test('saves the selected date when creating a movement', async () => {
    obtenerCategorias.mockResolvedValue({
      categorias: [{ id: 'category-1', name: 'Supermercado', type: 'GASTO' }]
    });
    obtenerMovimientos.mockResolvedValue({ movimientos: [] });
    render(<Registro />);

    await waitFor(() => expect(screen.getByLabelText('Cuenta')).toHaveValue('account-1'));
    fireEvent.change(screen.getByLabelText('¿Cuánto?'), { target: { value: '18.50' } });
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-12' } });
    fireEvent.click(await screen.findByRole('button', { name: /Supermercado/ }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar movimiento/i }));

    await waitFor(() => expect(guardarMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-12' })
    ));
  });
});
