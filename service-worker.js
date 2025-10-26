self.addEventListener('install', e => {
  self.skipWaiting();
  console.log('[SW] Instalado');
});

let appointments = [];

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'UPDATE_APPOINTMENTS') {
    appointments = e.data.appointments;
    console.log('[SW] Citas actualizadas:', appointments.length);
  }
});

setInterval(() => {
  const now = new Date();
  appointments.forEach(apt => {
    const diff = new Date(apt.dateTime) - now;
    if (diff > 0 && diff < 5 * 60 * 1000) {
      self.registration.showNotification('⏰ Recordatorio de Cita', {
        body: `Tienes una cita con ${apt.name} en menos de 5 minutos.`,
        icon: '/web/icono192.png',
        badge: '/web/icono192.png',
        vibrate: [200, 100, 200],
        tag: 'cita-recordatorio'
      });
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'PLAY_ALARM_SOUND' }));
      });
    }
  });
}, 60000);
