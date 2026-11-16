import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingToolboxProvider } from '@/components/landing/LandingToolbox';
import LandingEditMenu from '@/components/landing/LandingEditMenu';

function ToolboxFixture() {
  return <LandingToolboxProvider enabled>
    <div>
      <LandingEditMenu section label="Abschnitt bearbeiten">
        <button>Abschnittsaktion</button>
      </LandingEditMenu>
      <div>
        <span>Text wählen</span>
        <LandingEditMenu label="Text löschen">
          <button>Elementaktion</button>
        </LandingEditMenu>
      </div>
    </div>
  </LandingToolboxProvider>;
}

describe('Landingpage-Werkzeugkasten', () => {
  it('zeigt Abschnitts- und Elementaktionen getrennt und gleichzeitig', () => {
    render(<ToolboxFixture />);
    const toolbox = screen.getByRole('toolbar', { name: 'Werkzeugkasten' });
    expect(within(toolbox).getByText('Abschnittsänderungen')).toBeInTheDocument();
    expect(within(toolbox).getByText('Änderungen am gewählten Element')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abschnitt bearbeiten' }));
    expect(within(toolbox).getByRole('button', { name: 'Abschnittsaktion' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText('Text wählen'));
    expect(within(toolbox).getByRole('button', { name: 'Elementaktion' })).toBeInTheDocument();
    expect(within(toolbox).getByRole('button', { name: 'Abschnittsaktion' })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(within(toolbox).queryByRole('button', { name: 'Elementaktion' })).not.toBeInTheDocument();
    expect(within(toolbox).queryByRole('button', { name: 'Abschnittsaktion' })).not.toBeInTheDocument();
  });
});
