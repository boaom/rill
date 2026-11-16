/** 文本里 #话题# 的 chip 化渲染（不可点，spec：话题页延后）；段落用 block 消除折叠时的段间距。 */
function inline(text: string) {
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

export function TopicText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length <= 1) return inline(text);
  return (
    <>
      {paragraphs.map((part, index) => (
        <span className="para" key={`p-${index}`}>
          {inline(part)}
          {index < paragraphs.length - 1 ? <span className="para-sep" aria-hidden="true">{'\n\n'}</span> : null}
        </span>
      ))}
    </>
  );
}