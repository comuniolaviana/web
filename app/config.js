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

// Módulo de notificaciones.
if (!/admin\.html$/i.test(location.pathname)) {
  const notifCss = document.createElement("link");
  notifCss.rel = "stylesheet";
  notifCss.href = "notifications.css?v=6-2";
  document.head.appendChild(notifCss);

  const notifScript = document.createElement("script");
  notifScript.src = "notifications.js?v=6-2";
  document.head.appendChild(notifScript);

  // Portada V6.7: estados independientes, control de actualización y Noticias en Inicio.
  const homeCss = document.createElement("link");
  homeCss.rel = "stylesheet";
  homeCss.href = "home-v63.css?v=6-7";
  document.head.appendChild(homeCss);

  const homeScript = document.createElement("script");
  homeScript.src = "home-v63.js?v=6-7";
  document.head.appendChild(homeScript);
}
