(() => {
"use strict";

function pad(n){ return String(n).padStart(2,"0"); }
function validISO(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||"")); }
function parseISO(s){
  if(!validISO(s)) throw new Error("Fecha inválida: "+s);
  const [y,m,d]=s.split("-").map(Number);
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y || dt.getMonth()!==m-1 || dt.getDate()!==d) throw new Error("Fecha imposible: "+s);
  return dt;
}
function isoDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function compareISO(a,b){ return a<b?-1:a>b?1:0; }

function validate(cfg){
  if(!cfg || typeof cfg!=="object") throw new Error("calendario-clausulas.json no contiene un objeto válido.");
  if(!cfg.timezone) throw new Error("Falta timezone.");
  if(!cfg.horario?.inicio || !cfg.horario?.fin) throw new Error("Falta el horario.");
  if(!validISO(cfg.vigencia?.inicio) || !validISO(cfg.vigencia?.fin)) throw new Error("La vigencia no es válida.");
  parseISO(cfg.vigencia.inicio); parseISO(cfg.vigencia.fin);
  if(compareISO(cfg.vigencia.inicio,cfg.vigencia.fin)>0) throw new Error("La fecha inicial es posterior a la final.");

  const allowed=new Set(["abierto","especial","cerrado"]);
  const seen=new Set();
  for(const x of (cfg.fechas||[])){
    parseISO(x.fecha);
    if(!allowed.has(x.estado)) throw new Error("Estado inválido en "+x.fecha);
    if(seen.has(x.fecha)) throw new Error("Fecha duplicada: "+x.fecha);
    seen.add(x.fecha);
  }
  for(const x of (cfg.periodos||[])){
    parseISO(x.inicio); parseISO(x.fin);
    if(compareISO(x.inicio,x.fin)>0) throw new Error(`Periodo inválido: ${x.inicio}–${x.fin}`);
    if(!allowed.has(x.estado)) throw new Error("Estado inválido en periodo "+x.inicio);
  }
  return cfg;
}

class MotorCalendario {
  constructor(cfg){
    this.config=validate(cfg);
    this._fechas=new Map((cfg.fechas||[]).map(x=>[x.fecha,x]));
  }

  ahoraMadrid(){
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:this.config.timezone,
      year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",
      weekday:"short",hour12:false
    }).formatToParts(new Date());
    const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const weekday={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[v.weekday];
    return {
      fecha:`${v.year}-${v.month}-${v.day}`,
      hora:`${v.hour}:${v.minute}`,
      horaCompleta:`${v.hour}:${v.minute}:${v.second}`,
      diaSemana:weekday
    };
  }

  estado(fechaISO){
    parseISO(fechaISO);

    // PRIORIDAD 1: fecha exacta. Siempre manda sobre cualquier periodo.
    const exacta=this._fechas.get(fechaISO);
    if(exacta){
      return {
        estado:exacta.estado,
        motivo:exacta.motivo||"",
        etiqueta:exacta.etiqueta||this.etiqueta(exacta.estado),
        fuente:"fecha"
      };
    }

    // PRIORIDAD 2: fuera de la vigencia.
    if(compareISO(fechaISO,this.config.vigencia.inicio)<0){
      return {estado:"cerrado",motivo:this.config.fuera_vigencia?.antes||"Fuera de temporada.",etiqueta:"CERRADO",fuente:"vigencia"};
    }
    if(compareISO(fechaISO,this.config.vigencia.fin)>0){
      return {estado:"cerrado",motivo:this.config.fuera_vigencia?.despues||"Fuera de temporada.",etiqueta:"CERRADO",fuente:"vigencia"};
    }

    // PRIORIDAD 3: periodos especiales.
    for(const p of (this.config.periodos||[])){
      if(compareISO(fechaISO,p.inicio)>=0 && compareISO(fechaISO,p.fin)<=0){
        return {
          estado:p.estado,
          motivo:p.motivo||p.titulo||"",
          etiqueta:p.etiqueta||this.etiqueta(p.estado),
          titulo:p.titulo||"",
          fuente:"periodo"
        };
      }
    }

    // PRIORIDAD 4: regla ordinaria semanal.
    const d=parseISO(fechaISO);
    const abiertos=new Set(this.config.regla_ordinaria?.dias_semana||[]);
    if(abiertos.has(d.getDay())){
      return {
        estado:"abierto",
        motivo:this.config.regla_ordinaria?.motivo_abierto||"Día habilitado.",
        etiqueta:"ABIERTO",
        fuente:"ordinaria"
      };
    }
    return {
      estado:"cerrado",
      motivo:this.config.regla_ordinaria?.motivo_cerrado||"Día no habilitado.",
      etiqueta:"CERRADO",
      fuente:"ordinaria"
    };
  }

  estadoHoy(){
    const ahora=this.ahoraMadrid();
    return {...this.estado(ahora.fecha),fecha:ahora.fecha,hora:ahora.hora,diaSemana:ahora.diaSemana};
  }

  estadoAhora(){
    const hoy=this.estadoHoy();
    if(hoy.estado==="cerrado") return {...hoy,abiertoAhora:false};
    const {inicio,fin}=this.config.horario;
    const h=hoy.hora;
    return {
      ...hoy,
      abiertoAhora:h>=inicio && h<=fin,
      horarioInicio:inicio,
      horarioFin:fin
    };
  }

  etiqueta(estado){
    return estado==="especial"?"ESPECIAL":estado==="abierto"?"ABIERTO":"CERRADO";
  }

  proximaApertura(desdeISO,maxDias=400){
    let d=parseISO(desdeISO);
    for(let i=0;i<maxDias;i++){
      d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
      const iso=isoDate(d);
      const info=this.estado(iso);
      if(info.estado==="abierto" || info.estado==="especial") return {fecha:iso,...info};
      if(compareISO(iso,this.config.vigencia.fin)>0) break;
    }
    return null;
  }

  meses(){
    const a=parseISO(this.config.vigencia.inicio);
    const b=parseISO(this.config.vigencia.fin);
    const out=[];
    let y=a.getFullYear(),m=a.getMonth();
    while(y<b.getFullYear() || (y===b.getFullYear() && m<=b.getMonth())){
      out.push({anio:y,mes:m});
      m++; if(m===12){m=0;y++;}
    }
    return out;
  }

  fechasHabilitadas(){
    const start=parseISO(this.config.vigencia.inicio);
    const end=parseISO(this.config.vigencia.fin);
    const out=[];
    for(let d=new Date(start); d<=end; d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)){
      const fecha=isoDate(d);
      const info=this.estado(fecha);
      out.push({
        fecha,
        enabled:info.estado==="abierto" || info.estado==="especial",
        estado:info.estado,
        motivo:info.motivo,
        opens_at:this.config.horario.inicio+":00",
        closes_at:this.config.horario.fin+":00"
      });
    }
    return out;
  }
}

async function cargar(url="calendario-clausulas.json"){
  const sep=url.includes("?")?"&":"?";
  const res=await fetch(url+sep+"v="+Date.now(),{cache:"no-store"});
  if(!res.ok) throw new Error("No se pudo cargar "+url);
  const cfg=await res.json();
  return new MotorCalendario(cfg);
}

window.ComunioCalendario={
  cargar,
  crear:cfg=>new MotorCalendario(cfg),
  validar:validate,
  isoDate,
  parseISO
};
})();