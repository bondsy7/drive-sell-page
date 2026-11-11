import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BankLegalCheck } from './BankLegalCheck';

const banks = [{ bank_name: 'Leasys', legal_text: 'Angebot der {bank_name}, Musterstr. 1.' }];
const data: any = { category: 'Finanzierung', customerType: 'private', finance: { totalPrice: '30000' } };

async function openNotice(props: any) {
  render(<BankLegalCheck {...props} editVersion={1} />);
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull());
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
    fireEvent.click(box);
    expect(screen.queryByRole('alert')).not.toBeNull();
    expect(screen.queryByText(/Bankangaben bestätigt/)).toBeNull();
  }, 5000);

  it('re-opens the notice after a further edit and drops the confirmation', async () => {
    const props = { text: banks[0].legal_text, bankName: 'Leasys', banks, data };
    render(<BankLegalCheck {...props} editVersion={1} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull());
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByRole('alert')).toBeNull();
    // Simulate the next bank-field edit: the bound wrapper bumps editVersion.
    act(() => { window.dispatchEvent(new Event('bank-legal-edited')); });
    render(<BankLegalCheck {...props} editVersion={2} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull());
    expect(screen.queryByText(/Bankangaben bestätigt/)).toBeNull();
  }, 8000);
});
