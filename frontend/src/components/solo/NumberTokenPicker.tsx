type NumberTokenPickerProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberTokenPicker({ value, onChange, disabled }: NumberTokenPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-9">
      {NUMBERS.map(number => {
        const selected = number === value;
        return (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            disabled={disabled}
            className={`flex aspect-square items-center justify-center rounded-full text-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'scale-110 bg-primary text-primary-foreground shadow-lg shadow-primary/40'
                : 'border-2 border-border bg-card text-foreground hover:border-primary/40'
            }`}
          >
            {number}
          </button>
        );
      })}
    </div>
  );
}
