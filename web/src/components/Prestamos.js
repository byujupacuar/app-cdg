import React, { useCallback, useEffect, useState } from 'react';
import { abonarPrestamo, crearPrestamo, obtenerPrestamos } from '../services/api';

const currency = (amount) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(amount) || 0);

export default function Prestamos() {
  const [prestamos, setPrestamos] = useState([]);
  const [totales, setTotales] = useState({ totalPorCobrar: 0, totalPorPagar: 0 });
  const [tipoLista, setTipoLista] = useState('OTORGADO');
  const [contactName, setContactName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [tipoNuevo, setTipoNuevo] = useState('OTORGADO');
  const [abono, setAbono] = useState('');
  const [prestamoAbono, setPrestamoAbono] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await obtenerPrestamos();
      setPrestamos(response.prestamos || []);
      setTotales(response.totales || { totalPorCobrar: 0, totalPorPagar: 0 });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los préstamos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const submitLoan = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const amount = Number(totalAmount);
    if (!contactName.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Escribe un contacto y un monto mayor que cero.');
      return;
    }

    setSaving(true);
    try {
      await crearPrestamo({
        contactName: contactName.trim(),
        totalAmount: amount,
        type: tipoNuevo
      });
      setContactName('');
      setTotalAmount('');
      setMessage(tipoNuevo === 'OTORGADO' ? 'Préstamo registrado: queda pendiente de cobro.' : 'Deuda registrada correctamente.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el préstamo.');
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const amount = Number(abono);
    if (!prestamoAbono || !Number.isFinite(amount) || amount <= 0) {
      setError('Escribe un abono mayor que cero.');
      return;
    }

    setSaving(true);
    try {
      await abonarPrestamo(prestamoAbono.id, amount);
      setPrestamoAbono(null);
      setAbono('');
      setMessage('Abono registrado. El saldo pendiente se actualizó.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el abono.');
    } finally {
      setSaving(false);
    }
  };

  const loanList = prestamos.filter((loan) => loan.type === tipoLista);
  const pendientes = loanList.filter((loan) => Number(loan.dueAmount) > 0).length;

  return (
    <div className="loans-page">
      <section className="categories-intro">
        <div>
          <span className="panel-kicker">CUENTAS CLARAS</span>
          <h2>Préstamos y deudas</h2>
          <p>Lleva el control de lo que prestaste y lo que tienes pendiente por pagar.</p>
        </div>
        <span className="loan-intro-icon">↗</span>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      {message && <div className="inline-success" role="status">{message}</div>}

      <section className="loan-totals-grid">
        <article className="loan-total-card loan-receivable">
          <span className="loan-total-icon">↙</span>
          <span className="panel-kicker">TE DEBEN</span>
          <strong>{currency(totales.totalPorCobrar)}</strong>
          <small>Saldo pendiente de cobro</small>
        </article>
        <article className="loan-total-card loan-payable">
          <span className="loan-total-icon">↗</span>
          <span className="panel-kicker">DEBES</span>
          <strong>{currency(totales.totalPorPagar)}</strong>
          <small>Saldo pendiente de pago</small>
        </article>
      </section>

      <div className="loans-layout">
        <section className="panel-card loan-list-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">SEGUIMIENTO</span>
              <h2>Movimientos pendientes</h2>
            </div>
            <span className="budget-count">{pendientes}</span>
          </div>

          <div className="loan-tabs" role="tablist" aria-label="Filtrar préstamos">
            <button type="button" role="tab" aria-selected={tipoLista === 'OTORGADO'} className={tipoLista === 'OTORGADO' ? 'is-active' : ''} onClick={() => setTipoLista('OTORGADO')}>
              Te deben
            </button>
            <button type="button" role="tab" aria-selected={tipoLista === 'RECIBIDO'} className={tipoLista === 'RECIBIDO' ? 'is-active' : ''} onClick={() => setTipoLista('RECIBIDO')}>
              Debes
            </button>
          </div>

          {loading ? (
            <div className="page-loading"><span className="loader" />Cargando préstamos...</div>
          ) : loanList.length === 0 ? (
            <div className="panel-empty">
              <span>↗</span>
              <p>{tipoLista === 'OTORGADO' ? 'No tienes préstamos por cobrar.' : 'No tienes deudas registradas.'}</p>
              <small>Regístralos desde el formulario para tenerlos siempre a mano.</small>
            </div>
          ) : (
            <div className="loan-list">
              {loanList.map((loan) => {
                const total = Number(loan.totalAmount) || 0;
                const due = Number(loan.dueAmount) || 0;
                const paidPercent = total > 0 ? Math.min(((total - due) / total) * 100, 100) : 0;
                const settled = due <= 0;
                return (
                  <article className="loan-item" key={loan.id}>
                    <div className="loan-item-top">
                      <span className={`loan-contact-icon ${loan.type === 'OTORGADO' ? 'contact-receivable' : 'contact-payable'}`}>
                        {loan.contactName?.trim()?.charAt(0)?.toUpperCase() || '•'}
                      </span>
                      <div className="loan-contact-info">
                        <strong>{loan.contactName}</strong>
                        <small>{loan.type === 'OTORGADO' ? 'Le prestaste' : 'Te prestaron'} {currency(total)}</small>
                      </div>
                      <span className={`loan-state ${settled ? 'loan-settled' : 'loan-open'}`}>
                        {settled ? 'Liquidado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="loan-progress">
                      <span style={{ width: `${paidPercent}%` }} />
                    </div>
                    <div className="loan-item-bottom">
                      <span>Saldo <strong>{currency(due)}</strong></span>
                      {!settled && (
                        <button type="button" className="text-button" onClick={() => { setPrestamoAbono(loan); setAbono(''); }}>
                          Registrar abono <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel-card loan-form-panel">
          <span className="panel-kicker">AÑADIR REGISTRO</span>
          <h2>Nuevo préstamo</h2>
          <p className="form-intro">Registra un dinero prestado o una deuda pendiente.</p>
          <form onSubmit={submitLoan}>
            <label>Tipo de movimiento</label>
            <div className="loan-type-switch">
              <button type="button" className={tipoNuevo === 'OTORGADO' ? 'is-selected' : ''} onClick={() => setTipoNuevo('OTORGADO')}>
                Presté
              </button>
              <button type="button" className={tipoNuevo === 'RECIBIDO' ? 'is-selected' : ''} onClick={() => setTipoNuevo('RECIBIDO')}>
                Me prestaron
              </button>
            </div>
            <label htmlFor="loan-contact">Nombre de la persona</label>
            <input id="loan-contact" type="text" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Ej. Alex" maxLength={80} required />
            <label htmlFor="loan-total">Monto total</label>
            <div className="budget-amount-field">
              <span>$</span>
              <input id="loan-total" type="number" min="0.01" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="0.00" required />
            </div>
            <button className="button-primary form-submit" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar préstamo'}
            </button>
          </form>
        </section>
      </div>

      {prestamoAbono && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPrestamoAbono(null); }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <button className="dialog-close" type="button" aria-label="Cerrar" onClick={() => setPrestamoAbono(null)}>×</button>
            <span className="panel-kicker">ACTUALIZAR SALDO</span>
            <h2 id="payment-title">Abono de {prestamoAbono.contactName}</h2>
            <p className="form-intro">Saldo pendiente: <strong>{currency(prestamoAbono.dueAmount)}</strong></p>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <form onSubmit={submitPayment}>
              <label htmlFor="loan-payment">Monto del abono</label>
              <div className="budget-amount-field">
                <span>$</span>
                <input id="loan-payment" type="number" min="0.01" step="0.01" value={abono} onChange={(event) => setAbono(event.target.value)} placeholder="0.00" required autoFocus />
              </div>
              <button className="button-primary form-submit" type="submit" disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar abono'}
              </button>
              <button className="button-quiet" type="button" onClick={() => setPrestamoAbono(null)}>Cancelar</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
