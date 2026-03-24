import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import slide1Img from "../assets/slider1.png";
import slide2Img from "../assets/slider2.jpg";

const slides = [
  {
    id: 1,
    image: slide1Img,
    kicker: "Curated liquid biopsy reference",
    title: "cfDNA Database Knowledgebase",
    description: "Expertly curated data of circulating free DNA mutations and genomic datasets, providing comprehensive liquid biopsy metrics.",
    primaryAction: { label: "Browse records", to: "/browse" },
    secondaryAction: { label: "Open VCF demo", to: "/vcf-demo" },
  },
  {
    id: 2,
    image: slide2Img,
    kicker: "High-resolution datasets",
    title: "VCF-Oriented Release Portal",
    description: "Explore standardized manifestations of somatic mutations parsed from cell-free DNA repositories.",
    primaryAction: { label: "Download releases", to: "/downloads" },
    secondaryAction: { label: "Learn more", to: "/about" },
  }
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="hero-carousel">
      {slides.map((slide, index) => (
        <div 
          key={slide.id} 
          className={`carousel-slide ${index === currentSlide ? "active" : ""}`}
          style={{ backgroundImage: `url(${slide.image})` }}
        >
          <div className="carousel-overlay">
            <div className="carousel-container">
              <div className="carousel-content">
                <p className="hero-kicker">{slide.kicker}</p>
                <h1>{slide.title}</h1>
                <p className="hero-copy">{slide.description}</p>
                <div className="hero-actions-row">
                  <Link to={slide.primaryAction.to} className="button-primary">{slide.primaryAction.label}</Link>
                  <Link to={slide.secondaryAction.to} className="button-secondary">{slide.secondaryAction.label}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="carousel-container indicators-container">
        <div className="carousel-indicators">
          {slides.map((_, index) => (
            <button 
              key={index} 
              className={`indicator ${index === currentSlide ? "active" : ""}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
