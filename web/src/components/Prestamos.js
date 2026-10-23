import React, { useCallback, useEffect, useState } from 'react';
import {
  abonarPrestamo,
  actualizarPagoPrestamo,
  actualizarPlanPrestamo,
  crearPrestamo,
  eliminarPagoPrestamo,
  obtenerPrestamos
} from '../services/api';

const currency = (amount) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(amount) || 0);

const todayIsoDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDate = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
};

export default function Prestamos() {
  const [prestamos, setPrestamos] = useState([]);
  const [totales, setTotales] = useState({ totalPorCobrar: 0, totalPorPagar: 0 });
  const [tipoLista, setTipoLista] = useState('OTORGADO');
  const [contactName, setContactName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [loanDate, setLoanDate] = useState(todayIsoDate);
  const [dueDate, setDueDate] = useState('');
  const [newInstallments, setNewInstallments] = useState([]);
  const [tipoNuevo, setTipoNuevo] = useState('OTORGADO');
  const [abono, setAbono] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate);
  const [prestamoAbono, setPrestamoAbono] = useState(null);
  const [pagoEditando, setPagoEditando] = useState(null);
  const [montoPagoEditado, setMontoPagoEditado] = useState('');
  const [fechaPagoEditada, setFechaPagoEditada] = useState(todayIsoDate);
  const [prestamoPlan, setPrestamoPlan] = useState(null);
  const [planDueDate, setPlanDueDate] = useState('');
  const [planInstallments, setPlanInstallments] = useState([]);
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
    const installments = newInstallments.filter((installment) => installment.dueDate || installment.amount);
    if (installments.some((installment) => !installment.dueDate || !Number.isFinite(Number(installment.amount)) || Number(installment.amount) <= 0) ||
      (installments.length && installments.reduce((sum, installment) => sum + Math.round(Number(installment.amount) * 100), 0) !== Math.round(amount * 100))) {
      setError('Completa la fecha y el monto de cada cuota. La suma de las cuotas debe coincidir con el monto total.');
      return;
    }

    setSaving(true);
    try {
      await crearPrestamo({
        contactName: contactName.trim(),
        totalAmount: amount,
        type: tipoNuevo,
        loanDate,
        dueDate: dueDate || null,
        installments: installments.map((installment) => ({ dueDate: installment.dueDate, amount: Number(installment.amount) }))
      });
      setContactName('');
      setTotalAmount('');
      setLoanDate(todayIsoDate());
      setDueDate('');
      setNewInstallments([]);
      setMessage(tipoNuevo === 'OTORGADO'
        ? 'Préstamo registrado como gasto; queda pendiente de cobro.'
        : 'Préstamo recibido registrado como ingreso; queda pendiente de pago.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el préstamo.');
    } finally {
      setSaving(false);
    }
  };

  const editPlan = (loan) => {
    setPrestamoPlan(loan);
    setPlanDueDate(loan.dueDate ? String(loan.dueDate).slice(0, 10) : '');
    setPlanInstallments(loan.installments?.length
      ? loan.installments.map((installment) => ({ dueDate: String(installment.dueDate).slice(0, 10), amount: String(installment.amount) }))
      : [{ dueDate: todayIsoDate(), amount: String(loan.totalAmount) }]);
  };

  const submitPlan = async (event) => {
    event.preventDefault();
    setError('');
    const installments = planInstallments.filter((installment) => installment.dueDate || installment.amount);
    if (!installments.length || installments.some((installment) => !installment.dueDate || !Number.isFinite(Number(installment.amount)) || Number(installment.amount) <= 0) ||
      installments.reduce((sum, installment) => sum + Math.round(Number(installment.amount) * 100), 0) !== Math.round(Number(prestamoPlan.totalAmount) * 100)) {
      setError('Completa las fechas e importes. La suma de las cuotas debe coincidir con el monto original del préstamo.');
      return;
    }

    setSaving(true);
    try {
      await actualizarPlanPrestamo(prestamoPlan.id, {
        dueDate: planDueDate || null,
        installments: installments.map((installment) => ({ dueDate: installment.dueDate, amount: Number(installment.amount) }))
      });
      setPrestamoPlan(null);
      setMessage('Plan de pagos actualizado.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el plan de pagos.');
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
      await abonarPrestamo(prestamoAbono.id, amount, paymentDate);
      setPrestamoAbono(null);
      setAbono('');
      setPaymentDate(todayIsoDate());
      setMessage(prestamoAbono.type === 'OTORGADO'
        ? 'Pago registrado como ingreso; el saldo pendiente se actualizó.'
        : 'Pago registrado como gasto; el saldo pendiente se actualizó.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el abono.');
    } finally {
      setSaving(false);
    }
  };

  const openPaymentEditor = (payment) => {
    setPagoEditando(payment);
    setMontoPagoEditado(String(payment.amount));
    setFechaPagoEditada(String(payment.date).slice(0, 10));
    setError('');
  };

  const submitPaymentEdit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const amount = Number(montoPagoEditado);
    if (!pagoEditando || !Number.isFinite(amount) || amount <= 0 || !fechaPagoEditada) {
      setError('Escribe un monto mayor que cero y una fecha válida.');
      return;
    }

    setSaving(true);
    try {
      await actualizarPagoPrestamo(pagoEditando.id, { amount, date: fechaPagoEditada });
      setPagoEditando(null);
      setMessage('Pago actualizado.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (payment) => {
    if (!window.confirm('¿Eliminar este pago? También se actualizará el saldo del préstamo.')) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await eliminarPagoPrestamo(payment.id);
      setMessage('Pago eliminado y saldo actualizado.');
      await loadLoans();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el pago.');
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
                const payments = loan.payments || [];
                const paidTotal = total - due;
                const priorPayments = Math.max(0, paidTotal - payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
                const installments = loan.installments || [];
                return (
                  <article className="loan-item" key={loan.id}>
                    <div className="loan-item-top">
                      <span className={`loan-contact-icon ${loan.type === 'OTORGADO' ? 'contact-receivable' : 'contact-payable'}`}>
                        {loan.contactName?.trim()?.charAt(0)?.toUpperCase() || '•'}
                      </span>
                      <div className="loan-contact-info">
                        <strong>{loan.contactName}</strong>
                        <small>{loan.type === 'OTORGADO' ? 'Le prestaste' : 'Te prestaron'} {currency(total)}</small>
                        <small>Fecha del préstamo: {formatDate(loan.loanDate || loan.createdAt)}</small>
                      </div>
                      <span className={`loan-state ${settled ? 'loan-settled' : 'loan-open'}`}>
                        {settled ? 'Liquidado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="loan-schedule">
                      <strong>Fechas de pago</strong>
                      {loan.dueDate ? (
                        <small className={!settled && String(loan.dueDate).slice(0, 10) < todayIsoDate() ? 'loan-overdue' : ''}>
                          Fecha límite: {formatDate(loan.dueDate)}
                          {!settled && String(loan.dueDate).slice(0, 10) < todayIsoDate() ? ' · Vencido' : ''}
                        </small>
                      ) : <small>Sin fecha límite general.</small>}
                      {installments.length ? installments.map((installment) => {
                        const paidAmount = Number(installment.paidAmount);
                        const paid = paidAmount >= Number(installment.amount) - 0.005;
                        const overdue = !paid && !settled && String(installment.dueDate).slice(0, 10) < todayIsoDate();
                        return (
                          <div className="loan-payment-row" key={installment.id}>
                            <span className={overdue ? 'loan-overdue' : ''}>{formatDate(installment.dueDate)} · {paid ? 'Pagada' : paidAmount > 0 ? 'Parcial' : overdue ? 'Vencida' : 'Pendiente'}</span>
                            <strong>{paidAmount > 0 ? `${currency(paidAmount)} de ${currency(installment.amount)}` : currency(installment.amount)}</strong>
                          </div>
                        );
                      }) : <small>No hay cuotas programadas.</small>}
                      <button type="button" className="text-button" onClick={() => editPlan(loan)}>Programar fechas de pago</button>
                    </div>
                    <div className="loan-progress">
                      <span style={{ width: `${paidPercent}%` }} />
                    </div>
                    <div className="loan-item-bottom">
                      <span>Saldo <strong>{currency(due)}</strong></span>
                      {!settled && (
                        <button type="button" className="text-button" onClick={() => { setPrestamoAbono(loan); setAbono(''); setPaymentDate(todayIsoDate()); }}>
                          Registrar abono <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </div>
                    <div className="loan-payment-history">
                      <strong>Historial de pagos</strong>
                      {priorPayments > 0.005 && (
                        <small className="loan-prior-payments">Pagos anteriores sin fecha registrada: {currency(priorPayments)}</small>
                      )}
                      {payments.length === 0 && priorPayments <= 0.005 ? (
                        <small>Aún no hay pagos registrados.</small>
                      ) : payments.map((payment) => (
                        <div className="loan-payment-entry" key={payment.id}>
                          <div className="loan-payment-row">
                            <span>{formatDate(payment.date)}</span>
                            <strong>{currency(payment.amount)}</strong>
                          </div>
                          <div className="loan-payment-actions">
                            <button type="button" className="text-button" onClick={() => openPaymentEditor(payment)}>Editar</button>
                            <button type="button" className="text-button" onClick={() => deletePayment(payment)} disabled={saving}>Eliminar</button>
                          </div>
                        </div>
                      ))}
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
            <label htmlFor="loan-date">Fecha del préstamo</label>
            <input id="loan-date" type="date" value={loanDate} onChange={(event) => setLoanDate(event.target.value)} required />
            <label htmlFor="loan-due-date">Fecha límite general (opcional)</label>
            <input id="loan-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <label>Cuotas mensuales (opcional)</label>
            {newInstallments.map((installment, index) => (
              <div className="loan-installment-editor" key={`new-installment-${index}`}>
                <input aria-label={`Fecha de cuota ${index + 1}`} type="date" value={installment.dueDate} onChange={(event) => setNewInstallments((current) => current.map((item, i) => i === index ? { ...item, dueDate: event.target.value } : item))} />
                <input aria-label={`Monto de cuota ${index + 1}`} type="number" min="0.01" step="0.01" placeholder="Monto" value={installment.amount} onChange={(event) => setNewInstallments((current) => current.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} />
                <button type="button" className="text-button" aria-label={`Quitar cuota ${index + 1}`} onClick={() => setNewInstallments((current) => current.filter((_, i) => i !== index))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="text-button loan-add-installment" onClick={() => setNewInstallments((current) => [...current, { dueDate: todayIsoDate(), amount: '' }])}>+ Agregar cuota</button>
            <button className="button-primary form-submit" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar préstamo'}
            </button>
          </form>
        </section>
      </div>

      {prestamoPlan && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPrestamoPlan(null); }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="loan-plan-title">
            <button className="dialog-close" type="button" aria-label="Cerrar" onClick={() => setPrestamoPlan(null)}>×</button>
            <span className="panel-kicker">SEGUIMIENTO</span>
            <h2 id="loan-plan-title">Plan de pagos · {prestamoPlan.contactName}</h2>
            <p className="form-intro">Las cuotas deben sumar {currency(prestamoPlan.totalAmount)}.</p>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <form onSubmit={submitPlan}>
              <label htmlFor="loan-plan-due-date">Fecha límite general (opcional)</label>
              <input id="loan-plan-due-date" type="date" value={planDueDate} onChange={(event) => setPlanDueDate(event.target.value)} />
              <label>Cuotas mensuales</label>
              {planInstallments.map((installment, index) => (
                <div className="loan-installment-editor" key={`plan-installment-${index}`}>
                  <input aria-label={`Fecha de cuota ${index + 1}`} type="date" value={installment.dueDate} onChange={(event) => setPlanInstallments((current) => current.map((item, i) => i === index ? { ...item, dueDate: event.target.value } : item))} />
                  <input aria-label={`Monto de cuota ${index + 1}`} type="number" min="0.01" step="0.01" placeholder="Monto" value={installment.amount} onChange={(event) => setPlanInstallments((current) => current.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} />
                  <button type="button" className="text-button" aria-label={`Quitar cuota ${index + 1}`} onClick={() => setPlanInstallments((current) => current.filter((_, i) => i !== index))}>Quitar</button>
                </div>
              ))}
              <button type="button" className="text-button loan-add-installment" onClick={() => setPlanInstallments((current) => [...current, { dueDate: todayIsoDate(), amount: '' }])}>+ Agregar cuota</button>
              <button className="button-primary form-submit" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar plan'}
              </button>
              <button className="button-quiet" type="button" onClick={() => setPrestamoPlan(null)}>Cancelar</button>
            </form>
          </section>
        </div>
      )}

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
              <label htmlFor="loan-payment-date">Fecha del pago</label>
              <input id="loan-payment-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
              <button className="button-primary form-submit" type="submit" disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar abono'}
              </button>
              <button className="button-quiet" type="button" onClick={() => setPrestamoAbono(null)}>Cancelar</button>
            </form>
          </section>
        </div>
      )}

      {pagoEditando && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPagoEditando(null); }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="edit-payment-title">
            <button className="dialog-close" type="button" aria-label="Cerrar" onClick={() => setPagoEditando(null)}>×</button>
            <span className="panel-kicker">HISTORIAL</span>
            <h2 id="edit-payment-title">Editar pago</h2>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <form onSubmit={submitPaymentEdit}>
              <label htmlFor="edit-loan-payment">Monto del pago</label>
              <div className="budget-amount-field">
                <span>$</span>
                <input id="edit-loan-payment" type="number" min="0.01" step="0.01" value={montoPagoEditado} onChange={(event) => setMontoPagoEditado(event.target.value)} required />
              </div>
              <label htmlFor="edit-loan-payment-date">Fecha del pago</label>
              <input id="edit-loan-payment-date" type="date" value={fechaPagoEditada} onChange={(event) => setFechaPagoEditada(event.target.value)} required />
              <button className="button-primary form-submit" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button className="button-quiet" type="button" onClick={() => setPagoEditando(null)}>Cancelar</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
