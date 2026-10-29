import TextColorButton from '@/components/landing/TextColorButton';

/**
 * Pencil-menu action that sets a button's own background colour.
 * Same picker as the text colour, so both live side by side in one menu.
 */
export default function ButtonColorButton({ value, colors, onChange, label = 'Buttonfarbe ändern' }: {
  value?: string; colors: { label: string; value: string }[]; onChange: (color: string | null) => void; label?: string;
}) {
  return <TextColorButton
    value={value}
    colors={colors}
    onChange={onChange}
    label={label}
    heading="Buttonfarbe"
    text="Buttonfarbe"
  />;
}
