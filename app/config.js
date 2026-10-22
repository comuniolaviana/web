window.COMUNIO_CONFIG = {
  SUPABASE_URL: "https://oflgindcczjcddjoseut.supabase.co",
  // Clave pública de Supabase. Es segura para el frontend con RLS activado.
  SUPABASE_ANON_KEY: "sb_publishable_gun_Wvu4cIpDiLmAd5MIww_ruKI4IQG",

  // Dominio interno usado únicamente para convertir el nombre de usuario
  // en una identidad de Supabase. Los jugadores nunca necesitan saberlo.
  LOGIN_DOMAIN: "comuniolaviana.app",

  // Los nombres son públicos; los PIN NO están en la app.
  LOGIN_USERS: [
    "Adrian","Borja","Carlos","Dani","David","Eduardo","Efren","Enol","Jesus",
    "Jonatan","Jorge","Juanin","Laureano","Nazaré","Ordieres","PABLO","Ubaldo","Vizcaino"
  ],

  // Producción.
  DEMO_MODE: false,

  // Solo tienen efecto en demo.
  DEMO_FORCE_CLAUSES_OPEN: false,
  DEMO_FORCE_BADTEAM_OPEN: true,

  TIMEZONE: "Europe/Madrid",

  // Cláusulas entre usuarios.
  DEFAULT_OPEN: "15:00",
  DEFAULT_CLOSE: "21:00",

  // Equipo Malo: todos los días, 12:00–00:00.
  BADTEAM_OPEN: "12:00",
  BADTEAM_CLOSE: "00:00"
};
