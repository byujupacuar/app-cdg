import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Nivia sign-in screen when there is no session', () => {
  localStorage.removeItem('nivia_token');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Nivia' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(screen.getByLabelText('Correo Electrónico')).toBeInTheDocument();
});
