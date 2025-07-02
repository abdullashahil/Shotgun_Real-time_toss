export default function PlayerCard({ name, onSelect, disabled }: { name: string; onSelect: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className={`
        border rounded-lg p-3 w-full text-left transition-all duration-200
        ${disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
          : 'bg-white hover:bg-blue-50 hover:border-blue-300 border-gray-300 cursor-pointer'
        }
      `}
      onClick={onSelect}
    >
      <div className="font-medium">{name}</div>
    </button>
  );
}