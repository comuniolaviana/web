window.COMUNIO_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Dominio interno usado únicamente para convertir el nombre de usuario
  // en una identidad de Supabase. Los jugadores nunca necesitan saberlo.
  LOGIN_DOMAIN: "comuniolaviana.app",

  // Producción: false. Ponlo en true solo para pruebas locales sin contraseña.
  DEMO_MODE: false,

  // Permite probar botones a cualquier hora en demo.
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
