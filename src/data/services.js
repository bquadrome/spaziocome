export const SERVICES = [
  {
    id: 'coworking',
    name: 'Coworking e Studio',
    text: 'Postazioni dedicate a chi vuole lavorare, studiare o sviluppare un progetto in un ambiente connesso.',
    image: '/assets/area-coworking.png',
    kind: 'space',
  },
  {
    id: 'meeting',
    name: 'Meeting Room',
    text: 'Sala per riunioni, workshop, formazione e videoconferenze.',
    image: '/assets/area-meeting.png',
    kind: 'space',
  },
  {
    id: 'expo',
    name: 'Expo Space',
    text: 'Area espositiva per mostre, pop-up, presentazioni e valorizzazione di progetti.',
    image: '/assets/area-expo.png',
    kind: 'space',
  },
  {
    id: 'eu',
    name: 'EU Project Lab',
    text: 'Consulenza su bandi, co-progettazione europea e formazione.',
    image: '/assets/area-eu.png',
    kind: 'consult',
  },
]

export function getService(id) {
  return SERVICES.find((item) => item.id === id) ?? null
}
