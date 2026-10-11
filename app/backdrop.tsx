// The synthwave horizon: a striped sun sinking into a neon grid. Purely
// decorative, fixed behind the search and login pages (not the player).
export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="sky"><div className="sun" /></div>
      <div className="horizon" />
      <div className="floor"><div className="grid-lines" /></div>
    </div>
  )
}
