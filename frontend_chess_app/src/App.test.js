import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Retro Chess title', () => {
  render(<App />);
  const title = screen.getByText(/retro chess/i);
  expect(title).toBeInTheDocument();
});
