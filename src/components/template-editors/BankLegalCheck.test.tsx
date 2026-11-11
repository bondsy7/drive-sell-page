import { useEffect, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BankLegalCheck } from './BankLegalCheck';

const banks = [{ bank_name: 'Leasys', legal_text: 'Angebot der {bank_name}, Musterstr. 1.' }];
const data: any = { category: 'Finanzierung', customerType: 'private', finance: { totalPrice: '30000' } };

/** Mirrors BankLegalCheckBound: one mounted component whose editVersion rises on every bank-field edit. */
function Harness(props: any) {
  const [v, setV] = useState(1);
  useEffect(() => {
    const h = () => setV(n => n + 1);
    window.addEventListener('bank-legal-edited', h);
    return () => window.removeEventListener('bank-legal-edited', h);
  }, []);
  return <BankLegalCheck {...props} editVersion={v} />;
}

async function openNotice(props: any) {
  render(<Harness {...props} />);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull(), { timeout: 3000 });
}

describe('BankLegalCheck confirmation', () => {
  it('lets the user confirm the bank details via checkbox, which closes the notice', async () => {
    await openNotice({ text: banks[0].legal_text, bankName: 'Leasys', banks, data });
    const box = screen.getByRole('checkbox');
    expect(box).toBeEnabled();
    fireEvent.click(box);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Bankangaben bestätigt/)).toBeInTheDocument();
  }, 5000);

  it('keeps confirmation blocked while errors remain', async () => {
    await openNotice({ text: 'Angebot der {bank_name}, [Anschrift der Bank eintragen].', bankName: 'Leasys', banks, data });
    const box = screen.getByRole('checkbox');
    expect(box).toBeDisabled();
    // A stray click must not confirm while errors remain.
    fireEvent.click(box);
    expect(screen.queryByRole('alert')).not.toBeNull();
    expect(screen.queryByText(/Bankangaben bestätigt/)).toBeNull();
  }, 5000);

  it('re-opens the notice after a further edit and drops the confirmation', async () => {
    await openNotice({ text: banks[0].legal_text, bankName: 'Leasys', banks, data });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Bankangaben bestätigt/)).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event('bank-legal-edited')); });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull(), { timeout: 3000 });
    expect(screen.queryByText(/Bankangaben bestätigt/)).toBeNull();
  }, 8000);
});
