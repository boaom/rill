/** 文本里 #话题# 的 chip 化渲染（不可点，spec：话题页延后）。 */
export function TopicText({ text }: { text: string }) {
  const parts = text.split(/(#[^#\s]{1,20}#)/g).filter(Boolean);
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('#') && part.endsWith('#') && part.length > 2 ? (
          <span className="chip" key={`${part}-${index}`}>
            {part}
          </span>
        ) : (
          <span key={`t-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}