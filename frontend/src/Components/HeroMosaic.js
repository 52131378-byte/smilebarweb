import "../Assets/HeroMosaic.css";

export default function HeroMosaic({
  leftImage = "/2026smilebar.jpeg",
  topRightImage = "/choco.jpg",
  bottomRightImage = "/straw.jpg",
  leftAlt = "Hero image 1",
  topRightAlt = "Hero image 2",
  bottomRightAlt = "Hero image 3",
}) {
  return (
    <section className="hero-mosaic" aria-label="Hero">
      <div className="hero-mosaic__grid">
        <div className="hero-mosaic__tile hero-mosaic__tile--left">
          <img className="hero-mosaic__img" src={leftImage} alt={leftAlt} />
        </div>

        <div className="hero-mosaic__tile hero-mosaic__tile--top">
          <img
            className="hero-mosaic__img"
            src={topRightImage}
            alt={topRightAlt}
          />
        </div>

        <div className="hero-mosaic__tile hero-mosaic__tile--bottom">
          <img
            className="hero-mosaic__img"
            src={bottomRightImage}
            alt={bottomRightAlt}
          />
        </div>
      </div>
    </section>
  );
}


