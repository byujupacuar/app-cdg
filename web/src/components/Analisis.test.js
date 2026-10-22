import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Analisis from './Analisis';
import { exportarMovimientosCSV, obtenerDashboard } from '../services/api';

jest.mock('../services/api', () => ({
  exportarMovimientosCSV: jest.fn(),
  obtenerDashboard: jest.fn()
}));

describe('Analisis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    obtenerDashboard.mockResolvedValue({
      exito: true,
      resumen: {},
      resumenCuentas: { cuentas: [], totalDisponible: 600, deudaTarjetas: 50, patrimonioNeto: 550 },
      ultimosMovimientos: []
    });
    exportarMovimientosCSV.mockResolvedValue(new Blob(['Fecha,Monto']));
    URL.createObjectURL = jest.fn(() => 'blob:csv');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('applies and exports the full selected month', async () => {
    render(<Analisis />);

    fireEvent.click(screen.getByRole('button', { name: 'Por mes' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Aplicar mes' })).not.toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText('Mes a consultar'), {
      target: { value: '2024-02' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar mes' }));

    await waitFor(() => {
      expect(obtenerDashboard).toHaveBeenLastCalledWith(expect.objectContaining({
        fechaInicio: '2024-02-01',
        fechaFin: '2024-02-29',
        incluirTodos: true
      }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '↓ Exportar CSV' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: '↓ Exportar CSV' }));

    await waitFor(() => {
      expect(exportarMovimientosCSV).toHaveBeenCalledWith(expect.objectContaining({
        fechaInicio: '2024-02-01',
        fechaFin: '2024-02-29'
      }));
    });
  });

  test('shows period comparison and derives the savings rate from API totals', async () => {
    obtenerDashboard.mockResolvedValue({
      exito: true,
      resumen: { balanceTotal: 30, totalIngresos: 120, totalGastos: 90 },
      resumenCuentas: { cuentas: [], totalDisponible: 600, deudaTarjetas: 50, patrimonioNeto: 550 },
      ultimosMovimientos: [],
      gastosPorCategoria: []
    });

    render(<Analisis />);

    expect(await screen.findByRole('heading', { name: 'Ingresos y gastos' })).toBeInTheDocument();
    expect(screen.getByText('Tasa de ahorro: 25.0%')).toBeInTheDocument();
    expect(screen.getByText('Superávit').closest('.analysis-savings-rate')).toHaveTextContent('30');
    expect(screen.queryByText('Patrimonio neto actual')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Ingresos.*gastos/ })).toBeInTheDocument();
  });
});
