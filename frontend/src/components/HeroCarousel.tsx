import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import slide1Img from "../assets/slider1.png";
import slide2Img from "../assets/slider2.jpg";

const slides = [
  {
    id: 1,
    image: slide1Img,
    kicker: "Liquid biopsy mutation resource",
    title: "Somatic variant atlas for circulating cell-free DNA",
    description: "Query ANNOVAR-annotated somatic mutations across breast, colorectal, liver, lung, and pancreatic cohorts. Gene-centric search, functional class filtering, and cross-cohort comparative analysis in a single portal.",
    primaryAction: { label: "Search variants", to: "/gene-search?cancer=Breast&gene=TP53" },
    secondaryAction: { label: "Mutation analysis", to: "/mutation-analysis" }
  },
  {
    id: 2,
    image: slide2Img,
    kicker: "Multi-cohort statistical analysis",
    title: "Population-level cfDNA variant statistics and mutation signatures",
    description: "Explore functional region distributions, exonic mutation spectra, chromosomal variant burden, and per-sample mutation load across sequenced cfDNA cohorts processed through a standardized MuTect2 pipeline.",
    primaryAction: { label: "View statistics", to: "/mutation-analysis" },
    secondaryAction: { label: "Download data", to: "/downloads" }
  }
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-carousel">
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
                  {slide.primaryAction && (
                    <Link to={slide.primaryAction.to} className="button-primary">
                      {slide.primaryAction.label}
                    </Link>
                  )}
                  {slide.secondaryAction && (
                    <Link to={slide.secondaryAction.to} className="button-secondary">
                      {slide.secondaryAction.label}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="indicators-container">
        <div className="carousel-container">
          <div className="carousel-indicators">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentSlide ? "active" : ""}`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
