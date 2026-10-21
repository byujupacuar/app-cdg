import React, { useCallback, useEffect, useState } from 'react';
import {
  ajustarSaldoCuentaFinanciera,
  crearCuentaFinanciera,
  crearTransferencia,
  obtenerCuentasFinancieras,
  obtenerTransferencias
} from '../services/api';

const currency = (value) => new Intl.NumberFormat('es', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value) || 0);

const etiquetasTipo = {
  EFECTIVO: 'Efectivo',
  BANCO: 'Cuenta bancaria',
  DEBITO: 'Tarjeta de débito',
  CREDITO: 'Tarjeta de crédito',
  TARJETA: 'Tarjeta de débito'
};

export default function Cuentas({ onUpdated }) {
  const [cuentas, setCuentas] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [deudaTarjetas, setDeudaTarjetas] = useState(0);
  const [tipo, setTipo] = useState('EFECTIVO');
  const [tipoPersonalizado, setTipoPersonalizado] = useState('');
  const [bancoVinculadoId, setBancoVinculadoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [cuentaAjustando, setCuentaAjustando] = useState('');
  const [saldoAjustado, setSaldoAjustado] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [detalleTransferencia, setDetalleTransferencia] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [resumen, historial] = await Promise.all([
        obtenerCuentasFinancieras(),
        obtenerTransferencias()
      ]);
      setCuentas(resumen.cuentas || []);
      setTotalDisponible(resumen.totalDisponible || 0);
      setDeudaTarjetas(resumen.deudaTarjetas || 0);
      setTransferencias(historial.transferencias || []);
      setBancoVinculadoId((actual) => resumen.cuentas?.some((cuenta) => cuenta.id === actual && cuenta.type === 'BANCO')
        ? actual
        : resumen.cuentas?.find((cuenta) => cuenta.type === 'BANCO')?.id || '');
      const cuentasTransferibles = (resumen.cuentas || []).filter((cuenta) => cuenta.type !== 'DEBITO');
      setOrigen(cuentasTransferibles[0]?.id || '');
      setDestino(cuentasTransferibles[1]?.id || '');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las cuentas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleCrearCuenta = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    const tipoCuenta = tipo === 'OTRO' ? tipoPersonalizado.trim() : tipo;
    if (!nombre.trim() || !tipoCuenta) {
      setError('Ingresa el nombre y el tipo de la cuenta.');
      return;
    }
    if (!Number.isFinite(Number(saldoInicial)) || Number(saldoInicial) < 0) {
      setError('El saldo inicial debe ser un monto válido igual o mayor a cero.');
      return;
    }
    if (tipo === 'DEBITO' && !bancoVinculadoId) {
      setError('Añade o selecciona una cuenta bancaria para vincular la tarjeta de débito.');
      return;
    }

    setGuardando(true);
    try {
      await crearCuentaFinanciera({
        name: nombre.trim(),
        type: tipoCuenta,
        initialBalance: tipo === 'DEBITO' ? 0 : Number(saldoInicial),
        ...(tipo === 'DEBITO' && { linkedFinancialAccountId: bancoVinculadoId })
      });
      setNombre('');
      setSaldoInicial('0');
      setTipoPersonalizado('');
      setMensaje('Cuenta agregada. Ya puedes seleccionarla al registrar movimientos.');
      await cargarDatos();
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  const handleTransferencia = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    if (!origen || !destino || origen === destino || Number(montoTransferencia) <= 0) {
      setError('Selecciona dos cuentas distintas e ingresa un monto mayor a cero.');
      return;
    }

    setGuardando(true);
    try {
      await crearTransferencia({
        fromFinancialAccountId: origen,
        toFinancialAccountId: destino,
        amount: Number(montoTransferencia),
        description: detalleTransferencia.trim()
      });
      setMontoTransferencia('');
      setDetalleTransferencia('');
      setMensaje('Transferencia registrada; no se contó como ingreso ni como gasto.');
      await cargarDatos();
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la transferencia.');
    } finally {
      setGuardando(false);
    }
  };

  const handleAjustarSaldo = async (event, cuenta) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    if (!Number.isFinite(Number(saldoAjustado)) || Number(saldoAjustado) < 0) {
      setError('El saldo actual debe ser un monto válido igual o mayor a cero.');
      return;
    }
    setGuardando(true);
    try {
      await ajustarSaldoCuentaFinanciera(cuenta.id, Number(saldoAjustado));
      setCuentaAjustando('');
      setSaldoAjustado('');
      setMensaje(`Saldo de ${cuenta.name} actualizado.`);
      await cargarDatos();
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo ajustar el saldo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="financial-accounts-page">
      <section className="categories-intro">
        <div>
          <span className="panel-kicker">ORGANIZA TU DINERO</span>
          <h2>Cuentas</h2>
          <p>Consulta tus saldos y registra transferencias entre tus cuentas.</p>
        </div>
        <div className="movement-intro-icon">▤</div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      {mensaje && <div className="inline-success" role="status">{mensaje}</div>}

      <section className="account-totals">
        <article className="panel-card account-total-card">
          <span className="panel-kicker">DINERO DISPONIBLE</span>
          <strong>{currency(totalDisponible)}</strong>
          <small>Todos los saldos disponibles; débito vinculado sin duplicar</small>
        </article>
        <article className="panel-card account-total-card account-net-worth-card">
          <span className="panel-kicker">PATRIMONIO NETO</span>
          <strong>{currency(Number(totalDisponible) - Number(deudaTarjetas))}</strong>
          <small>Dinero disponible menos deuda de tarjetas</small>
        </article>
        <article className="panel-card account-total-card account-debt-card">
          <span className="panel-kicker">DEUDA EN TARJETAS</span>
          <strong>{currency(deudaTarjetas)}</strong>
          <small>Se muestra aparte, no como dinero disponible</small>
        </article>
      </section>

      <section className="account-page-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">TUS SALDOS</span>
              <h2>Cuentas</h2>
            </div>
          </div>
          {cargando ? (
            <div className="form-loading"><span className="loader" />Cargando cuentas...</div>
          ) : cuentas.length === 0 ? (
            <div className="panel-empty"><span>＋</span><p>Añade tu primera cuenta.</p></div>
          ) : (
            <div className="account-balance-list">
              {cuentas.map((cuenta) => (
                <div className="account-balance-item" key={cuenta.id}>
                  <span className={`account-type-icon ${cuenta.esCredito ? 'is-credit' : ''}`} aria-hidden="true">
                    {cuenta.type === 'EFECTIVO' ? '◉' : cuenta.type === 'CREDITO' ? '▣' : '▤'}
                  </span>
                  <span className="account-balance-info">
                    <strong>{cuenta.name}</strong>
                    <small>{cuenta.esDebitoVinculado ? `Tarjeta de débito · vinculada a ${cuenta.cuentaVinculada}` : etiquetasTipo[cuenta.type] || cuenta.type}</small>
                  </span>
                  <strong className={cuenta.esCredito ? 'amount-negative' : 'account-amount'}>
                    {currency(cuenta.esCredito ? cuenta.deuda : cuenta.saldo)}
                    {cuenta.esCredito && <small> deuda</small>}
                  </strong>
                  {cuenta.esDebitoVinculado ? (
                    <small className="account-form-help">Saldo de la cuenta bancaria</small>
                  ) : (
                    <button
                      type="button"
                      className="text-button account-adjust-button"
                      onClick={() => {
                        setCuentaAjustando(cuenta.id);
                        setSaldoAjustado(String(cuenta.esCredito ? cuenta.deuda : cuenta.saldo));
                      }}
                    >
                      Ajustar
                    </button>
                  )}
                  {cuentaAjustando === cuenta.id && (
                    <form className="account-adjust-form" onSubmit={(event) => handleAjustarSaldo(event, cuenta)}>
                      <label htmlFor={`account-balance-${cuenta.id}`}>{cuenta.esCredito ? 'Deuda actual' : 'Saldo actual'}</label>
                      <small className="account-form-help">Ajustar el saldo no modifica los movimientos anteriores.</small>
                      <input
                        id={`account-balance-${cuenta.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={saldoAjustado}
                        onChange={(event) => setSaldoAjustado(event.target.value)}
                        required
                      />
                      <button className="button-primary" type="submit" disabled={guardando}>Guardar saldo</button>
                      <button className="text-button" type="button" onClick={() => setCuentaAjustando('')}>Cancelar</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card account-form-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">AÑADIR</span>
              <h2>Nueva cuenta</h2>
            </div>
          </div>
          <form className="account-form" onSubmit={handleCrearCuenta}>
            <label htmlFor="account-name">Nombre</label>
            <input id="account-name" value={nombre} maxLength={60} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Banco principal" required />
            <label htmlFor="account-type">Tipo</label>
            <select id="account-type" value={tipo} onChange={(event) => setTipo(event.target.value)}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="BANCO">Cuenta bancaria</option>
              <option value="DEBITO">Tarjeta de débito</option>
              <option value="CREDITO">Tarjeta de crédito</option>
              <option value="OTRO">Otro</option>
            </select>
            {tipo === 'OTRO' && (
              <>
                <label htmlFor="account-custom-type">Tipo personalizado</label>
                <input id="account-custom-type" value={tipoPersonalizado} maxLength={30} onChange={(event) => setTipoPersonalizado(event.target.value)} placeholder="Ej. Billetera digital" required />
                <small className="account-form-help">Puedes añadir billeteras digitales u otras cuentas.</small>
              </>
            )}
            {tipo === 'DEBITO' ? (
              cuentas.some((cuenta) => cuenta.type === 'BANCO') ? (
                <>
                  <label htmlFor="linked-bank-account">Cuenta bancaria vinculada</label>
                  <select id="linked-bank-account" value={bancoVinculadoId} onChange={(event) => setBancoVinculadoId(event.target.value)} required>
                    {cuentas.filter((cuenta) => cuenta.type === 'BANCO').map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.name}</option>)}
                  </select>
                  <small className="account-form-help">La tarjeta usa el saldo del banco y no se suma dos veces.</small>
                </>
              ) : <small className="account-form-help">Primero añade una cuenta bancaria para vincular esta tarjeta.</small>
            ) : (
              <>
                <label htmlFor="account-initial-balance">{tipo === 'CREDITO' ? 'Deuda actual al añadirla' : 'Saldo actual al añadirla'}</label>
                <input id="account-initial-balance" type="number" min="0" step="0.01" value={saldoInicial} onChange={(event) => setSaldoInicial(event.target.value)} required />
                <small className="account-form-help">
                  {tipo === 'CREDITO'
                    ? 'Escribe lo que ya debes en la tarjeta. Las compras aumentarán la deuda y los pagos la reducirán.'
                    : 'Escribe el saldo que ya tienes. Los próximos ingresos y gastos actualizarán este total.'}
                </small>
              </>
            )}
            <button className="button-primary" type="submit" disabled={guardando || (tipo === 'DEBITO' && !bancoVinculadoId)}>
              {guardando ? 'Guardando...' : 'Añadir cuenta'}
            </button>
          </form>
        </article>

        <article className="panel-card account-form-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">MOVER DINERO</span>
              <h2>Transferencia entre cuentas</h2>
            </div>
          </div>
          {cuentas.filter((cuenta) => cuenta.type !== 'DEBITO').length < 2 ? (
            <p className="account-form-help">Añade por lo menos dos cuentas para registrar una transferencia.</p>
          ) : (
            <form className="account-form" onSubmit={handleTransferencia}>
              <label htmlFor="transfer-from">Desde</label>
              <select
                id="transfer-from"
                value={origen}
                onChange={(event) => {
                  const nuevoOrigen = event.target.value;
                  setOrigen(nuevoOrigen);
                  if (nuevoOrigen === destino) {
                    setDestino(cuentas.find((cuenta) => cuenta.id !== nuevoOrigen && cuenta.type !== 'DEBITO')?.id || '');
                  }
                }}
                required
              >
                {cuentas.filter((cuenta) => cuenta.type !== 'DEBITO').map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.name}</option>)}
              </select>
              <label htmlFor="transfer-to">Hacia</label>
              <select id="transfer-to" value={destino} onChange={(event) => setDestino(event.target.value)} required>
                {cuentas.filter((cuenta) => cuenta.id !== origen && cuenta.type !== 'DEBITO').map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.name}</option>)}
              </select>
              <label htmlFor="transfer-amount">Monto</label>
              <input id="transfer-amount" type="number" min="0.01" step="0.01" value={montoTransferencia} onChange={(event) => setMontoTransferencia(event.target.value)} required />
              <label htmlFor="transfer-description">Detalle (opcional)</label>
              <input id="transfer-description" maxLength={120} value={detalleTransferencia} onChange={(event) => setDetalleTransferencia(event.target.value)} placeholder="Ej. Retiro de efectivo" />
              <small className="account-form-help">La transferencia actualiza ambos saldos, sin alterar ingresos o gastos.</small>
              <button className="button-primary" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar transferencia'}</button>
            </form>
          )}
        </article>

        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">ACTIVIDAD</span>
              <h2>Transferencias recientes</h2>
            </div>
          </div>
          {transferencias.length === 0 ? (
            <div className="panel-empty"><span>↔</span><p>Aún no hay transferencias.</p></div>
          ) : (
            <div className="account-balance-list">
              {transferencias.map((transferencia) => (
                <div className="account-balance-item" key={transferencia.id}>
                  <span className="account-type-icon" aria-hidden="true">↔</span>
                  <span className="account-balance-info">
                    <strong>{transferencia.fromFinancialAccount.name} → {transferencia.toFinancialAccount.name}</strong>
                    <small>{transferencia.description || new Date(transferencia.date).toLocaleDateString()}</small>
                  </span>
                  <strong className="account-amount">{currency(transferencia.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
