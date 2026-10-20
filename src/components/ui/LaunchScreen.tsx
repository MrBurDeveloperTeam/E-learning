/**
 * Full-screen loading screen. Intentionally IDENTICAL (markup, sizes, colours, text)
 * to the gallery's /opening.html and the splash inside #root in index.html, so moving
 * from Snabbb -> E-Learning looks like one continuous loading screen. The shared
 * styles live in index.html (#ls-css).
 */
export function LaunchScreen({
  title = 'Opening E-Learning…',
  status = 'Signing you in…',
}: {
  title?: string
  status?: string
}) {
  return (
    <div className="ls" role="status" aria-live="polite">
      <img
        className="ls-icon"
        src="https://app.snabbb.com/icons/new-icons/e-learning.png?v=1"
        alt=""
        width={160}
        height={160}
      />
      <div className="ls-spinner" aria-hidden="true" />
      <h1 className="ls-title">{title}</h1>
      <p className="ls-status">{status}</p>
    </div>
  )
}
