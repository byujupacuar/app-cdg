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

  test('shows period metrics, a time trend, and expense category distribution', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    obtenerDashboard.mockResolvedValue({
      exito: true,
      resumen: { balanceTotal: 30, totalIngresos: 120, totalGastos: 90 },
      resumenCuentas: { cuentas: [], totalDisponible: 600, deudaTarjetas: 50, patrimonioNeto: 550 },
      ultimosMovimientos: [
        { id: 'income', amount: 120, type: 'INGRESO', date: `${today}T12:00:00.000Z` },
        { id: 'expense', amount: 90, type: 'GASTO', date: `${today}T13:00:00.000Z` }
      ],
      gastosPorCategoria: [
        { id: 'food', nombre: 'Alimentación', icono: '🍎', monto: 90, porcentaje: 100 }
      ]
    });

    render(<Analisis />);

    expect(await screen.findByRole('heading', { name: 'Ingresos y gastos en el tiempo' })).toBeInTheDocument();
    expect(screen.getByText('Balance neto').nextElementSibling).toHaveTextContent('30');
    expect(screen.getByRole('img', { name: /Gráfico de ingresos y gastos por intervalo/ })).toBeInTheDocument();
    const categoryChart = screen.getByRole('img', { name: /Distribución de gastos por categoría/ });
    expect(categoryChart).toBeInTheDocument();
    expect(categoryChart).toBeEmptyDOMElement();
    expect(categoryChart.nextElementSibling).toHaveClass('analysis-category-total');
    expect(categoryChart.nextElementSibling).toHaveTextContent('Total de gastos');
    expect(screen.getByText(/Alimentación/)).toBeInTheDocument();
    expect(screen.queryByText('Patrimonio neto actual')).not.toBeInTheDocument();
  });
});
