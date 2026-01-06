import "../Assets/HeroSection.css";

export default function HeroSection({
  imageSrc = "/pancake.jpg",
  alt = "Hero",
}) {
  return (
    <section className="hero">
      <div className="hero__inner">
        <img className="hero__image" src={imageSrc} alt={alt} />
      </div>
    </section>
  );
}


