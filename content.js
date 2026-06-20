/* ============================================================================
   CONTENU DU PORTFOLIO — Steven Dieu
   ----------------------------------------------------------------------------
   👉 C'est LE seul fichier que tu as besoin de modifier pour mettre à jour
      ton portfolio : tes infos, tes projets, tes liens de contact.
      Aucune connaissance technique requise : remplace simplement le texte
      entre guillemets. Garde les guillemets et les virgules en place.
   ============================================================================ */

const CONTENT = {

  /* --- Identité (écran d'intro) ------------------------------------------- */
  identity: {
    firstName: "Steven",
    lastName:  "Dieu",
    // Ta date de naissance — l'âge est calculé automatiquement à chaque visite.
    birthDate: "1992-10-26",          // format AAAA-MM-JJ
    role:      "Tech Lead Java / Angular",
    city:      "Nantes",
    tagline:   "Nantais, bâtisseur d'applis solides et de jolies interfaces.",
  },

  /* --- Projets (orbes flottants à attraper en sautant) --------------------
     Ajoute / retire / modifie autant de projets que tu veux.
     - title       : nom du projet
     - tag         : petite étiquette courte (ex: "Site vitrine", "App web")
     - year        : année ou période
     - description : 1 à 3 phrases (l'explication montrée dans la pop-up)
     - stack       : liste de technos (s'affiche en pastilles)
     - link        : URL cliquable (laisse "" si aucun lien)
     - linkLabel   : texte du bouton de lien
     - icon        : emoji de SECOURS, affiché si le logo n'est pas encore là
     - premium     : true => projet « GOLD ». Orbe DORÉ plus gros, placé sur la
                     PREMIÈRE carte (Lille), à mettre en avant.
     - first       : true => c'est le TOUT PREMIER orbe, posé bas juste après le
                     départ : on l'attrape rien qu'en marchant. (un seul projet)
     - logo        : image du logo du site, affichée DANS le cercle de l'orbe et
                     dans la pop-up. Dépose le fichier dans assets/projets/<dossier>/
                     (PNG transparent de préférence). Laisse "" tant qu'il manque.
     - shots       : captures d'écran montrées dans le petit CARROUSEL de la
                     pop-up. Liste de chemins, ex:
                       ["assets/projets/listopia/capture-1.webp",
                        "assets/projets/listopia/capture-2.webp"]
                     Laisse [] tant que tu n'as pas encore tes captures.
  ------------------------------------------------------------------------- */
  projects: [
    /* ===== Projets GOLD = mes side projects perso (mis en avant, 1re carte) ===
       Listopia, Tooda, Blinee, PausePump : mes propres idées, du concept au
       produit en ligne. Ce sont les orbes dorés « projets phares ». ========= */
    {
      title: "Listopia",
      tag: "App web & mobile",
      year: "",                          // <- à compléter (ex: "2025")
      description: "Mon appli pour créer une liste de cadeaux à partager en quelques secondes, sans inscription. Les proches réservent leurs cadeaux en secret, le créateur ne voit rien jusqu'au jour J : fini les doublons. On ajoute un cadeau en collant simplement le lien (Amazon, Fnac, Zalando...), et il existe aussi en application mobile. Un projet perso mené de l'idée jusqu'à la mise en ligne.",
      stack: ["Svelte", "TypeScript", "Node.js", "Supabase", "Capacitor", "Tailwind CSS"],
      link: "https://listopia.fr/",
      linkLabel: "Visiter le site",
      icon: "📝",
      premium: true,
      first: true,                       // <- premier orbe, attrapé en marchant
      logo: "assets/projets/listopia/logo.png",
      shots: [
        "assets/projets/listopia/capture-1.webp",
        "assets/projets/listopia/capture-3.webp",
        "assets/projets/listopia/capture-4.webp",
      ],
    },
    {
      title: "Tooda",
      tag: "Plateforme DIY",
      year: "",                          // <- à compléter
      description: "Ma plateforme communautaire dédiée au fait-maison : chacun publie et découvre des recettes de cosmétiques et de produits ménagers, naturels et économiques. Messagerie entre membres, favoris, dictionnaire d'ingrédients et même la possibilité pour les créateurs de monétiser leurs recettes. Un projet perso pensé de A à Z, du back-end au design.",
      stack: ["Angular", "Spring Boot", "Java", "Firebase", "NgRx"],
      link: "https://tooda.fr/",
      linkLabel: "Visiter le site",
      icon: "✨",
      premium: true,
      logo: "assets/projets/tooda/logo.png",
      shots: [
        "assets/projets/tooda/capture-1.webp",
        "assets/projets/tooda/capture-3.webp",
        "assets/projets/tooda/capture-2.webp",
        "assets/projets/tooda/capture-4.webp",
      ],
    },
    {
      title: "Blinee",
      tag: "Blind test musical (IA)",
      year: "",                          // <- à compléter
      description: "Un blind test musical d'un nouveau genre : les morceaux à deviner sont générés par intelligence artificielle. On écoute, on devine, on s'amuse. Côté technique, tout le traitement audio se fait directement dans le navigateur (lecture, découpage des extraits, formes d'onde) et s'appuie sur la génération de musique par IA. Encore un projet perso, de l'idée jusqu'à la mise en ligne.",
      stack: ["Angular", "Java", "Spring Boot", "Audio Web", "IA"],
      link: "https://blinee.fr/",
      linkLabel: "Visiter le site",
      icon: "💡",
      premium: true,
      logo: "assets/projets/blinee/logo.png",
      shots: [
        "assets/projets/blinee/capture-1.webp",
        "assets/projets/blinee/capture-4.webp",
        "assets/projets/blinee/capture-3.webp",
      ],
    },
    {
      title: "PausePump",
      tag: "App mobile (PWA)",
      year: "",                          // <- à compléter
      description: "Mon petit coach d'entraînement par intervalles : on règle ses temps d'effort et de récupération, et l'appli enchaîne les séries automatiquement avec décompte, sons et vibrations. Pensée pour le mobile et installable comme une vraie application (PWA), elle continue même écran éteint. Un projet perso simple et utile, né d'un besoin du quotidien.",
      stack: ["JavaScript", "PWA", "HTML", "CSS"],
      link: "https://ligolabs.github.io/PausePump/",
      linkLabel: "Visiter le site",
      icon: "⏸️",
      premium: true,
      logo: "assets/projets/pausepump/logo.png",
      shots: [
        "assets/projets/pausepump/capture-1.webp",
        "assets/projets/pausepump/capture-4.webp",
        "assets/projets/pausepump/capture-3.webp",
        "assets/projets/pausepump/capture-2.webp",
      ],
    },

    /* ===== Projets CLIENTS (cartes suivantes : Paris, Nantes…) =========== */
    {
      title: "Aedile (Landing)",
      tag: "Landing page",
      year: "",                          // <- à compléter
      description: "Page de présentation (landing page) d'Aedile, un outil de gestion de projet décentralisé bâti sur la blockchain Internet Computer. L'objectif : présenter clairement le produit et ses promesses (récompenses en tokens, financement communautaire, gouvernance) et donner envie au visiteur de s'inscrire, avec une mise en page soignée et animée.",
      stack: [],                         // <- stack à confirmer (page Vercel, code non local)
      link: "https://landing-rust-gamma.vercel.app/",
      linkLabel: "Visiter le site",
      icon: "🚀",
      logo: "assets/projets/landing/logo.png",
      shots: [
        "assets/projets/landing/capture-1.webp",
        "assets/projets/landing/capture-2.webp",
        "assets/projets/landing/capture-3.webp",
      ],
    },
    {
      title: "Golden Triangle",
      tag: "Site + réservation",
      year: "",                          // <- à compléter
      description: "Site d'une conciergerie immobilière haut de gamme sur la Côte d'Azur (Villefranche-sur-Mer, Saint-Jean-Cap-Ferrat, Beaulieu). Il met en valeur des villas et appartements de luxe, propose un blog de la région et intègre directement la réservation en ligne. Projet client, du site vitrine jusqu'au moteur de réservation.",
      stack: ["WordPress", "PHP", "SuperHote"],
      link: "https://goldentriangle.fr/fr/homepage-fr/",
      linkLabel: "Visiter le site",
      icon: "🔺",
      logo: "assets/projets/goldentriangle/logo.png",
      orbLogo: "assets/projets/goldentriangle/emblem.png",   // logotype trop fin dans l'orbe -> emblème (silhouette) dédié
      shots: [
        "assets/projets/goldentriangle/capture-1.webp",
        "assets/projets/goldentriangle/capture-2.webp",
        "assets/projets/goldentriangle/capture-3.webp",
      ],
    },
    {
      title: "Bernard Soria",
      tag: "Site vitrine & boutique",
      year: "",                          // <- à compléter
      description: "Site portfolio du photographe Bernard Soria : présentation de ses séries photographiques, boutique de tirages, agenda des expositions et vernissages, et espace presse. Réalisé sur WordPress avec un thème entièrement sur mesure pour coller à son univers artistique. Projet client.",
      stack: ["WordPress", "PHP", "Thème sur mesure"],
      link: "https://bernardsoria.com/",
      linkLabel: "Visiter le site",
      icon: "🎨",
      logo: "assets/projets/bernardsoria/logo.png",
      shots: [
        "assets/projets/bernardsoria/capture-1.webp",
        "assets/projets/bernardsoria/capture-3.webp",
        "assets/projets/bernardsoria/capture-2.webp",
      ],
    },
    {
      title: "Lacme Prod",
      tag: "Site vitrine",
      year: "",                          // <- à compléter
      description: "Site vitrine de LACMÉ, studio et label de podcasts : il présente le studio, ses séries audio originales et les services proposés aux marques comme aux créateurs. Un site rapide et léger, centré sur l'univers narratif de la marque. Projet client.",
      stack: ["HTML", "CSS", "JavaScript", "Parcel"],
      link: "https://lacmeprod.com/",
      linkLabel: "Visiter le site",
      icon: "🎬",
      logo: "assets/projets/lacmeprod/logo.png",
      shots: [
        "assets/projets/lacmeprod/capture-1.webp",
        "assets/projets/lacmeprod/capture-2.webp",
        "assets/projets/lacmeprod/capture-4.webp",
        "assets/projets/lacmeprod/capture-5.webp",
      ],
    },
    {
      title: "Valléescope",
      tag: "Plateforme culturelle",
      year: "",                          // <- à compléter
      description: "Agenda culturel du territoire Vallée Sud Grand Paris : la plateforme rassemble les spectacles (théâtre, danse, concerts, cirque, jeune public) des 19 salles du territoire, avec une recherche fine par date, ville, type et public, une carte interactive et des coups de cœur. Projet client développé sur mesure en Symfony.",
      stack: ["Symfony", "PHP", "Bootstrap", "Google Maps"],
      link: "https://www.valleescope.fr/",
      linkLabel: "Visiter le site",
      icon: "🏞️",
      logo: "assets/projets/valleescope/logo.png",
      shots: [
        "assets/projets/valleescope/capture-1.webp",
        "assets/projets/valleescope/capture-2.webp",
        "assets/projets/valleescope/capture-3.webp",
      ],
    },
  ],

  /* --- Contact (zone de fin du niveau) ------------------------------------ */
  contact: {
    headline: "Merci d'avoir joué !",
    subtitle: "Une idée, un projet, une envie de discuter ? Écris-moi.",
    links: [
      { label: "Email",    value: "sdieu@stediconsulting.fr", href: "mailto:sdieu@stediconsulting.fr", icon: "✉️" },
      { label: "LinkedIn", value: "linkedin.com/in/steven-dieu-bb3ab69b", href: "https://www.linkedin.com/in/steven-dieu-bb3ab69b/", icon: "💼" },
      { label: "GitHub",   value: "github.com/LigoLabs", href: "https://github.com/LigoLabs", icon: "🐙" },
    ],
  },
};

// Rendu accessible au reste du jeu (ne pas toucher).
if (typeof window !== "undefined") window.CONTENT = CONTENT;
