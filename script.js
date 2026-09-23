/* ==========================================================================
   Pferdeosteopathie und Reitunterricht – Melanie Siedentop
   Kein Tracking, keine externen Dienste, keine Cookies.
   ========================================================================== */
(() => {
  "use strict";

  const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
  const MAIL = "info@pferdeosteopathie-siedentop.de";
  const GALERIE_MAX = 40; // maximal so viele Bilder (galerie-1 bis galerie-40)

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Jahreszahl in der Fußzeile ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Kopfzeile: Linie beim Scrollen ---------- */
  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobiles Menü ---------- */
  const toggle = $(".nav-toggle");
  const nav = $("#site-nav");
  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 70rem)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------- Menü: aktuellen Abschnitt hervorheben ---------- */
  const navLinks = $$(".nav__link");
  if (navLinks.length && "IntersectionObserver" in window) {
    const byId = new Map();
    navLinks.forEach((link) => {
      const id = (link.getAttribute("href") || "").replace("#", "");
      const section = id && document.getElementById(id);
      if (section) byId.set(section, link);
    });
    const contact = document.getElementById("kontakt");
    if (contact) byId.set(contact, null); // im Kontaktbereich ist kein Menüpunkt aktiv
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((l) => l.removeAttribute("aria-current"));
          const link = byId.get(entry.target);
          if (link) link.setAttribute("aria-current", "true");
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    byId.forEach((_, section) => observer.observe(section));
  }

  /* ---------- Hilfsfunktion: Bild laden, falls vorhanden ---------- */
  const probe = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  /* ---------- Eigenes Logo: images/logo.svg oder images/logo.png ---------- */
  const brandMark = $(".brand__mark");
  if (brandMark) {
    const findLogo = async () => {
      for (const name of ["logo.svg", "logo.png"]) {
        const url = new URL("images/" + name, SCRIPT_URL).href;
        const img = await probe(url);
        if (img) return { url, img, isPng: name.endsWith(".png") };
      }
      return null;
    };
    findLogo().then((found) => {
      if (!found) return;
      const { url, img, isPng } = found;
      const logo = document.createElement("img");
      logo.className = "brand__logo";
      // Ein PNG mit weißem Hintergrund wird auf dem hellen Seitenhintergrund unsichtbar verrechnet
      if (isPng) {
        logo.classList.add("brand__logo--blend");
        if (header) header.classList.add("has-blend-logo");
      }
      logo.src = url;
      logo.alt = "";
      // Sehr breites Logo (enthält vermutlich schon den Schriftzug): Text daneben ausblenden
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      const text = $(".brand__text");
      if (ratio > 2.5 && text) text.hidden = true;
      brandMark.replaceWith(logo);
      // Auch das Browser-Symbol (Favicon) ersetzen
      const icon = $('link[rel="icon"]');
      if (icon) {
        icon.href = url;
        icon.type = isPng ? "image/png" : "image/svg+xml";
      }
    });
  }

  /* ---------- Fotos: erlaubte Dateiendungen ---------- */
  const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG"];
  let lastExtension = null; // zuletzt gefundene Endung wird zuerst probiert (weniger Fehlversuche)

  const probePhoto = async (name) => {
    const order = lastExtension
      ? [lastExtension, ...EXTENSIONS.filter((e) => e !== lastExtension)]
      : EXTENSIONS;
    for (const ext of order) {
      const img = await probe(`images/${name}.${ext}`);
      if (img) {
        lastExtension = ext;
        return img;
      }
    }
    return null;
  };

  /* ---------- Optionale Fotos: images/hero und images/melanie ---------- */
  const placePhoto = async (name, target, caption) => {
    if (!target) return;
    const img = await probePhoto(name);
    if (!img) return;
    target.src = img.src;
    target.hidden = false;
    if (caption) caption.hidden = false; // Bildunterschrift nur zeigen, wenn das Foto da ist
  };
  placePhoto("hero", $("#hero-photo"), $("#hero-caption"));
  placePhoto("melanie", $("#about-photo"));

  /* ---------- Galerie als Diashow: images/galerie-1, galerie-2, ... ---------- */
  const slider = $("#slider");
  const viewport = $("#slider-viewport");
  const zoomBtn = $("#slider-zoom");
  const prevBtn = $("#slider-prev");
  const nextBtn = $("#slider-next");
  const playBtn = $("#slider-play");
  const dotsBox = $("#slider-dots");
  const countEl = $("#slider-count");
  const gallerySection = $("#galerie");
  const galleryNav = $("[data-gallery-nav]");
  const lightbox = $("#lightbox");
  const lbImg = $("#lightbox-img");
  const lbCount = $("#lightbox-count");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const INTERVAL = 5500; // Sekunden zwischen den Bildern (in Millisekunden)
  const DOTS_MAX = 12; // ab so vielen Bildern werden statt Punkten nur Zahlen gezeigt

  const photos = [];
  const slides = [];
  const dots = [];
  let current = 0; // aktuelles Bild in der Großansicht
  let slideIndex = 0; // aktuelles Bild in der Diashow
  let timer = null;
  let userPaused = false;
  let hoverPause = false;
  let focusPause = false;
  let inView = true;

  const showPhoto = (index) => {
    current = (index + photos.length) % photos.length;
    lbImg.src = photos[current].src;
    lbImg.alt = photos[current].alt;
    lbCount.textContent = `Bild ${current + 1} von ${photos.length}`;
  };

  const canPlay = () =>
    slides.length > 1 &&
    !userPaused &&
    !reduceMotion.matches &&
    !hoverPause &&
    !focusPause &&
    inView &&
    !document.hidden &&
    !(lightbox && lightbox.open);

  const schedule = () => {
    clearTimeout(timer);
    if (canPlay()) timer = setTimeout(() => goTo(slideIndex + 1), INTERVAL);
  };

  const updateSliderUi = () => {
    const many = slides.length > 1;
    if (prevBtn) prevBtn.hidden = !many;
    if (nextBtn) nextBtn.hidden = !many;
    if (playBtn) playBtn.hidden = !many || reduceMotion.matches;
    if (countEl) {
      countEl.hidden = !many;
      countEl.textContent = `${slideIndex + 1} / ${slides.length}`;
    }
    if (dotsBox) dotsBox.hidden = !many || slides.length > DOTS_MAX;
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === slideIndex);
      if (i === slideIndex) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  };

  const goTo = (index) => {
    if (!slides.length) return;
    slideIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === slideIndex);
      slide.setAttribute("aria-hidden", String(i !== slideIndex));
    });
    updateSliderUi();
    schedule();
  };

  const openLightbox = (index) => {
    if (!lightbox || typeof lightbox.showModal !== "function") {
      window.open(photos[index].src, "_blank", "noopener");
      return;
    }
    showPhoto(index);
    lightbox.showModal();
    schedule(); // pausiert die Diashow, solange die Großansicht offen ist
  };

  // Einzelnes Bild (z. B. Flyer) in der Großansicht, ohne Blättern
  const openSingle = (src, alt) => {
    if (!lightbox || typeof lightbox.showModal !== "function") {
      window.open(src, "_blank", "noopener");
      return;
    }
    lightbox.classList.add("is-single");
    lbImg.src = src;
    lbImg.alt = alt;
    lbCount.textContent = "";
    lightbox.showModal();
    schedule();
  };

  const addSlide = (img, number) => {
    const alt = `Foto ${number} aus der Galerie`;
    photos.push({ src: img.src, alt });

    const slide = document.createElement("div");
    slide.className = "slide";
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "Bild");
    slide.setAttribute("aria-label", `Foto ${number}`);
    slide.setAttribute("aria-hidden", "true");

    const backdrop = new Image();
    backdrop.className = "slide__bg";
    backdrop.src = img.src;
    backdrop.alt = "";
    backdrop.setAttribute("aria-hidden", "true");

    const photo = new Image();
    photo.className = "slide__img";
    photo.src = img.src;
    photo.alt = alt;
    photo.decoding = "async";

    slide.append(backdrop, photo);
    viewport.insertBefore(slide, zoomBtn);
    slides.push(slide);

    if (dotsBox) {
      const index = slides.length - 1;
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider__dot";
      dot.setAttribute("aria-label", `Foto ${number} anzeigen`);
      dot.addEventListener("click", () => goTo(index));
      dotsBox.appendChild(dot);
      dots.push(dot);
    }
  };

  const loadGallery = async () => {
    if (!slider || !viewport) return;
    for (let i = 1; i <= GALERIE_MAX; i++) {
      const img = await probePhoto(`galerie-${i}`);
      if (!img) break; // Bilder müssen lückenlos nummeriert sein
      addSlide(img, i);
      if (slides.length === 1) {
        if (gallerySection) gallerySection.hidden = false;
        if (galleryNav) galleryNav.hidden = false;
        goTo(0);
      } else {
        updateSliderUi();
        schedule();
      }
    }
  };

  if (slider && viewport) {
    zoomBtn.addEventListener("click", () => openLightbox(slideIndex));
    prevBtn.addEventListener("click", () => goTo(slideIndex - 1));
    nextBtn.addEventListener("click", () => goTo(slideIndex + 1));

    playBtn.addEventListener("click", () => {
      userPaused = !userPaused;
      playBtn.classList.toggle("is-paused", userPaused);
      playBtn.setAttribute(
        "aria-label",
        userPaused ? "Automatischen Wechsel starten" : "Automatischen Wechsel anhalten"
      );
      schedule();
    });

    // Pause, wenn die Maus darüber steht oder per Tastatur fokussiert wird
    slider.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") { hoverPause = true; schedule(); }
    });
    slider.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") { hoverPause = false; schedule(); }
    });
    slider.addEventListener("focusin", (e) => {
      if (e.target.matches(":focus-visible")) { focusPause = true; schedule(); }
    });
    slider.addEventListener("focusout", () => { focusPause = false; schedule(); });

    // Pfeiltasten
    slider.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") goTo(slideIndex - 1);
      if (e.key === "ArrowRight") goTo(slideIndex + 1);
    });

    // Wischen mit dem Finger
    let swipeX = null;
    let swipeY = null;
    viewport.addEventListener("touchstart", (e) => {
      swipeX = e.changedTouches[0].clientX;
      swipeY = e.changedTouches[0].clientY;
    }, { passive: true });
    viewport.addEventListener("touchend", (e) => {
      if (swipeX === null) return;
      const dx = e.changedTouches[0].clientX - swipeX;
      const dy = e.changedTouches[0].clientY - swipeY;
      swipeX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goTo(slideIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // Nur abspielen, solange die Galerie sichtbar ist und der Tab offen ist
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.25 }).observe(viewport);
    }
    document.addEventListener("visibilitychange", schedule);
    reduceMotion.addEventListener("change", () => { updateSliderUi(); schedule(); });
  }
  loadGallery();

  /* ---------- Flyer: images/flyer, images/flyer2 (jpg, jpeg, png, webp) ---------- */
  const loadFlyer = (name, figureId, imgId, openId) => {
    const figure = $(figureId);
    const img = $(imgId);
    if (!figure || !img) return;
    probePhoto(name).then((found) => {
      if (!found) return;
      img.src = found.src;
      img.width = found.naturalWidth;
      img.height = found.naturalHeight;
      figure.hidden = false;
    });
    $(openId).addEventListener("click", () => openSingle(img.src, img.alt));
  };
  loadFlyer("flyer", "#flyer", "#flyer-img", "#flyer-open");
  loadFlyer("flyer2", "#flyer2", "#flyer2-img", "#flyer2-open");

  if (lightbox) {
    lightbox.addEventListener("close", () => {
      const wasSingle = lightbox.classList.contains("is-single");
      lightbox.classList.remove("is-single");
      if (!wasSingle && slides.length) goTo(current);
      else schedule();
    });
    $("#lightbox-close").addEventListener("click", () => lightbox.close());
    $("#lightbox-prev").addEventListener("click", () => showPhoto(current - 1));
    $("#lightbox-next").addEventListener("click", () => showPhoto(current + 1));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.classList.contains("lightbox__inner")) lightbox.close();
    });
    // Wischen mit dem Finger: nach links = nächstes Bild, nach rechts = vorheriges
    let touchStartX = null;
    lightbox.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (lightbox.classList.contains("is-single")) return;
      if (Math.abs(dx) > 50) showPhoto(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
    lightbox.addEventListener("keydown", (e) => {
      if (lightbox.classList.contains("is-single")) return;
      if (e.key === "ArrowLeft") showPhoto(current - 1);
      if (e.key === "ArrowRight") showPhoto(current + 1);
    });
  }

  /* ---------- Anruf-Knopf (Handy): im Kontaktbereich ausblenden ---------- */
  const fab = $("#call-fab");
  const contactSection = $("#kontakt");
  if (fab && contactSection && "IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => entries.forEach((e) => fab.classList.toggle("is-hidden", e.isIntersecting)),
      { threshold: 0.15 }
    ).observe(contactSection);
  }

  /* ---------- Kontaktformular: bereitet eine E-Mail vor (kein Server nötig) ---------- */
  const form = $("#contact-form");
  const status = $("#form-status");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const get = (key) => String(data.get(key) || "").trim();

      const lines = [
        "Hallo Melanie,",
        "",
        "ich möchte gern einen Termin anfragen.",
        "",
        `Worum geht es: ${get("anliegen")}`,
      ];
      if (get("pferd")) lines.push(`Pferd (Name, Rasse, Alter): ${get("pferd")}`);
      if (get("ort")) lines.push(`Standort des Pferdes: ${get("ort")}`);
      lines.push("", "Meine Nachricht:", get("nachricht"), "", "Viele Grüße", get("name"));
      if (get("telefon")) lines.push(`Telefon: ${get("telefon")}`);

      const subject = `Terminanfrage: ${get("anliegen")}`;
      const href =
        `mailto:${MAIL}?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(lines.join("\r\n"))}`;

      window.location.href = href;

      if (status) {
        status.hidden = false;
        status.innerHTML =
          'Dein E-Mail-Programm sollte sich jetzt mit der vorbereiteten Nachricht öffnen. ' +
          'Falls nicht, schreib bitte direkt an <a href="mailto:' + MAIL + '">' + MAIL + "</a>.";
      }
    });
  }
})();
