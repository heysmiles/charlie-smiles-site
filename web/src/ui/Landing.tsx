/**
 * The still, warm page you land on. A normal block at the top of the page;
 * the world scrolls up beneath it.
 */
export function Landing() {
  return (
    <div className="landing">
      <div className="landing__inner">
        <video className="landing__star" src="/brand/star.webm" poster="/brand/star.png" autoPlay muted loop playsInline />
        <h1 className="landing__name" aria-label="Charlie Smiles" />
        <div className="landing__cue">
          <span className="landing__tagline">to enter, surf the internet</span>
          <span className="landing__arrow" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
