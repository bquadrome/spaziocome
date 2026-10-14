export default function TitleLines({ text }) {
  const parts = String(text ?? '').split('\n')
  return parts.map((part, i) => (
    <span key={i}>
      {i ? <br /> : null}
      {part}
    </span>
  ))
}
