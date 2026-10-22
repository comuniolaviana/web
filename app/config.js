window.COMUNIO_CONFIG = {
  SUPABASE_URL: "https://oflgindcczjcddjoseut.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_gun_Wvu4cIpDiLmAd5MIww_ruKI4IQG",

  LOGIN_DOMAIN: "comuniolaviana.app",

  LOGIN_USERS: [
    "Adrian","Borja","Carlos","Dani","David","Eduardo","Efren","Enol","Jesus",
    "Jonatan","Jorge","Juanin","Laureano","Nazaré","Ordieres","PABLO","Ubaldo","Vizcaino"
  ],

  DEMO_MODE: false,
  DEMO_FORCE_CLAUSES_OPEN: false,
  DEMO_FORCE_BADTEAM_OPEN: true,

  TIMEZONE: "Europe/Madrid",

  DEFAULT_OPEN: "15:00",
  DEFAULT_CLOSE: "21:00",

  BADTEAM_OPEN: "12:00",
  BADTEAM_CLOSE: "00:00"
};

// Carga independiente del módulo de notificaciones.
// No modifica la lógica principal de la app.
if (!/admin\.html$/i.test(location.pathname)) {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "notifications.css?v=6-1";
  document.head.appendChild(css);

  const script = document.createElement("script");
  script.src = "notifications.js?v=6-1";
  script.defer = true;
  document.head.appendChild(script);
}
