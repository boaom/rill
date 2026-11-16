/** 段控件（feed-tab / profile-tab）：等分 + 底部强调指示条。 */
export function Segment<T extends string>({
  items,
  value,
  onChange,
  testid,
  label,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  testid: string;
  label: string;
}) {
  return (
    <div className="segment" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          className="segment__item"
          data-testid={testid}
          data-selected={item.key === value}
          aria-selected={item.key === value}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}