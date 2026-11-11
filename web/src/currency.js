export const availableCurrencies = [
  ['ARS', 'Peso argentino'],
  ['BOB', 'Boliviano'],
  ['BRL', 'Real brasileño'],
  ['CAD', 'Dólar canadiense'],
  ['CLP', 'Peso chileno'],
  ['COP', 'Peso colombiano'],
  ['CRC', 'Colón costarricense'],
  ['DOP', 'Peso dominicano'],
  ['EUR', 'Euro'],
  ['GBP', 'Libra esterlina'],
  ['GTQ', 'Quetzal guatemalteco'],
  ['HNL', 'Lempira hondureño'],
  ['MXN', 'Peso mexicano'],
  ['NIO', 'Córdoba nicaragüense'],
  ['PAB', 'Balboa panameño'],
  ['PEN', 'Sol peruano'],
  ['PYG', 'Guaraní paraguayo'],
  ['USD', 'Dólar estadounidense'],
  ['UYU', 'Peso uruguayo']
];

export const formatCurrency = (value, currency = 'USD') => new Intl.NumberFormat('es', {
  style: 'currency',
  currency
}).format(Number(value) || 0);

export const currencySymbol = (currency = 'USD') => new Intl.NumberFormat('es', {
  style: 'currency',
  currency,
  currencyDisplay: 'narrowSymbol'
}).formatToParts(0).find((part) => part.type === 'currency')?.value || currency;
