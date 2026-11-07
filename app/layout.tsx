import type { ReactNode } from 'react';
 
export const metadata = {
  title: 'Agendamento · Estética Automotiva',
  description: 'Agende seu horário online',
};
 
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#f4f6f9' }}>{children}</body>
    </html>
  );
}
 
