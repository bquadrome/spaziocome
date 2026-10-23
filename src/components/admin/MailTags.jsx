// Barra di tag dinamici: click inserisce {{tag}} nel campo mail attivo.
export default function MailTags({ tags, onInsert }) {
  return (
    <div className="mail-tags" role="group" aria-label="Tag dinamici utilizzabili">
      <span className="mail-tags-title">Tag dinamici</span>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="mail-tag"
          // Non rubare il focus al campo: così l'inserimento va al cursore.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(tag)}
          title={`Inserisci {{${tag}}}`}
        >
          {`{{${tag}}}`}
        </button>
      ))}
    </div>
  )
}
