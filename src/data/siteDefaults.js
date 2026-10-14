export const SECTION_IDS = ['hero', 'eventi', 'progetto', 'offriamo', 'audience', 'spaces', 'map']

export const SECTION_LABELS = {
  hero: 'Hero',
  eventi: 'Eventi (carosello)',
  progetto: 'Il progetto',
  offriamo: 'Cosa offriamo',
  audience: 'Per chi è pensato',
  spaces: 'Gli spazi',
  map: 'Mappa',
}

export const DEFAULT_SITE = {
  sectionOrder: [...SECTION_IDS],
  hidden: [],
  header: {
    bookLabel: 'Prenota il tuo spazio',
    bookHref: '#spazi',
    areaLabel: 'Area Riservata',
    areaHref: '/staff',
    biosLabel: 'Ideato da BIOS',
    biosHref: 'https://www.associazionebios.org/',
    links: [
      { href: '#progetto', label: 'Il progetto' },
      { href: '#offriamo', label: 'Cosa offriamo' },
      { href: '#spazi', label: 'Gli spazi' },
    ],
  },
  hero: {
    title: 'Primo Hub di Innovazione\na Messina',
    text: 'Un nuovo spazio dove idee, talenti e connessioni prendono forma… Come sentirsi a casa.',
    ctaLabel: 'Scopri il progetto',
    ctaHref: '#progetto',
    image: '/assets/hero.png',
  },
  progetto: {
    label: 'IL PROGETTO',
    titleLead: 'Co.Me.',
    titleMid: ' è il progetto di innovazione ',
    titleTail: 'numero 1 in Sicilia',
    text1:
      'Da qui nasce Spazio COME un coworking 2.0 dove professionisti, startup, studenti e associazioni si incontrano, collaborano e fanno crescere nuove idee.',
    text2: 'Dove le connessioni diventano opportunità.',
    ctaLabel: 'Esplora lo spazio',
    ctaHref: '#spazi',
    image: '/assets/progetto.png',
    imageAlt: 'Open space coworking di Spazio COME a Messina',
  },
  offriamo: {
    label: 'COSA OFFRIAMO',
    title: 'Uno spazio',
    titleRest: 'per ogni esigenza.',
    text: 'Sei aree uniche pensate per connettere talenti, amplificare la creatività e dare forma ai tuoi progetti nel cuore di Messina.',
    cards: [
      {
        title: 'Co-working Area',
        text: 'Postazioni flessibili ed ergonomiche con connettività Starlink. Il tuo ufficio dinamico, prenotabile online.',
        image: '/assets/area-coworking.png',
        wide: true,
      },
      {
        title: 'Meeting room',
        text: 'Sala multimediale per riunioni e videoconferenze professionali, con accesso diretto al terrazzo.',
        image: '/assets/area-meeting.png',
        wide: false,
      },
      {
        title: 'Digital lab',
        text: 'Studio di ultima generazione per produzione audio/video, web radio, podcast e creatività digitale.',
        image: '/assets/area-digital.png',
        wide: false,
      },
      {
        title: 'Rooftop',
        text: 'Spazio esclusivo vista centro storico di Messina. Perfetto per eventi all’aperto e networking.',
        image: '/assets/area-rooftop.png',
        wide: false,
      },
      {
        title: 'Expo space',
        text: 'Spazio fluido e modulare per mostre, workshop ed eventi. Il posto dove ogni idea prende vita.',
        image: '/assets/area-expo.png',
        wide: false,
      },
      {
        title: 'EU project lab',
        text: 'Hub strategico dedicato alla progettazione europea. Dove le idee diventano progetti finanziati.',
        image: '/assets/area-eu.png',
        wide: true,
      },
    ],
  },
  audience: {
    label: 'PER CHI È PENSATO',
    titleLead: 'Co.Me.',
    titleRest: ' è per te.',
    text: 'Se stai cercando la concentrazione per i tuoi progetti o l’energia di un team in crescita, qui trovi il tuo habitat ideale.',
    cards: [
      {
        icon: '/assets/icon-freelance.svg',
        title: 'Professionisti e Freelance',
        text: 'Molto più di una scrivania. Trova la concentrazione di cui hai bisogno e connettiti con una community di talenti pronti a ispirarti e fare rete ogni giorno.',
      },
      {
        icon: '/assets/icon-aziende.svg',
        title: 'Aziende e Startup',
        text: "L'ecosistema ideale per accelerare il tuo business. Spazi flessibili, tecnologie all'avanguardia e le connessioni giuste per far crescere il tuo team.",
      },
      {
        icon: '/assets/icon-community.svg',
        title: 'Associazioni e Community',
        text: 'Condividi valori, crea opportunità. Uno spazio accogliente e attrezzato con tutti gli strumenti necessari per dare voce e impatto ai tuoi progetti culturali.',
      },
    ],
  },
  spaces: {
    label: 'GLI SPAZI',
    title: 'Prenota il tuo',
    titleRest: 'spazio.',
    text: 'Quattro ambienti da vivere nel cuore di Messina. Scegli quello che fa per te e prenota.',
    ctaLabel: 'Prenota',
    items: [
      {
        id: 'coworking',
        name: 'Coworking e Studio',
        text: 'Postazioni dedicate a chi vuole lavorare, studiare, seguire lezioni online, sviluppare un progetto o concentrarsi sulle proprie attività in un ambiente accogliente, luminoso e connesso.',
        image: '/assets/area-coworking.png',
        features: [
          { icon: 'starlink', title: 'Connessione', subtitle: 'ultra veloce' },
          { icon: 'desk', title: 'Postazioni', subtitle: 'ergonomiche' },
          { icon: 'people', title: 'Community', subtitle: 'e networking' },
        ],
      },
      {
        id: 'meeting',
        name: 'Meeting Room',
        text: 'Sala attrezzata e versatile per riunioni, workshop, corsi di formazione, presentazioni e videoconferenze. Spazio professionale, moderno e dinamico.',
        image: '/assets/area-meeting.png',
        features: [
          { icon: 'av', title: 'Dotazioni audio-video', subtitle: 'per conferenze' },
          { icon: 'calendar', title: 'Spazio dinamico', subtitle: 'e multifunzionale' },
          { icon: 'access', title: 'Accesso smart', subtitle: 'e prenotazione rapida' },
        ],
      },
      {
        id: 'expo',
        name: 'Expo Space',
        text: 'Area espositiva modulabile dedicata a mostre, installazioni, presentazioni, pop-up, attività culturali, promozionali e valorizzazione di progetti, idee e brand.',
        image: '/assets/area-expo.png',
        features: [
          { icon: 'layout', title: 'Allestimento', subtitle: 'modulabile' },
          { icon: 'audience', title: 'Eventi', subtitle: 'e inaugurazioni' },
          { icon: 'visibility', title: 'Visibilità', subtitle: 'e networking' },
        ],
      },
      {
        id: 'eu',
        name: 'EU Project Lab',
        text: 'Il servizio di Spazio COME dedicato alle opportunità e alla progettazione europea. Offre consulenza specialistica a giovani, associazioni, enti e imprese nella ricerca di bandi e finanziamenti, nella progettazione e nella comunicazione e valorizzazione dei progetti.',
        image: '/assets/area-eu.png',
        features: [
          { icon: 'grant', title: 'Consulenza', subtitle: 'bandi UE' },
          { icon: 'codesign', title: 'Co-progettazione', subtitle: 'europea' },
          { icon: 'training', title: 'Formazione', subtitle: 'e networking' },
        ],
      },
    ],
  },
  map: {
    titleLead: 'Co.Me.',
    titleAccent: 'trovarci!',
    text: 'Ci trovi nel cuore di Messina, a pochi passi dai principali collegamenti. Le porte sono aperte: passa a trovarci per scoprire lo spazio e conoscere la community.',
    embed:
      'https://maps.google.com/maps?q=Via%20I%20Settembre%2015%2C%2098122%20Messina&z=17&output=embed',
    iframeTitle: 'Ex Hotel Liberty (4° piano) - Via I Settembre n. 15 – Messina',
  },
  footer: {
    address1: 'Via I Settembre, 15 - quarto piano',
    address2: 'Presso Residence Liberty',
    address3: '98122 – Messina',
    email: 'info@spaziocome.it',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/', icon: '/assets/icon-social-1.svg' },
      { label: 'Instagram', href: 'https://www.instagram.com/', icon: '/assets/icon-social-2.svg' },
      {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/company/spazio-come-coworking-messina/',
        icon: '/assets/icon-social-3.svg',
      },
    ],
  },
}
