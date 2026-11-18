/* ==========================================================================
   FOREVER WORLD — Contenido maestro
   Regla de este archivo: aquí hay MECÁNICAS, METAS y PREGUNTAS.
   El lore (historia, religión, nombres, leyes) lo escriben los jugadores
   dentro de la app; nada de lo de aquí es canon de su mundo.
   ========================================================================== */

window.FW_DATA = (() => {
  /* -------------------- Jugadores y Estados por defecto -------------------- */
  const DEFAULT_BANK_NAME = 'La Gran Cámara del Ender';
  // Unidad de cuenta neutral = canasta ½ Dracma + ½ Cuarto (no es moneda física)
  const DEFAULT_BASKET = { name: 'Ojo de Ender', plural: 'Ojos de Ender', symbol: 'OE' };

  const DEFAULT_NATIONS = {
    myth: {
      player: 'Mythstorm',
      nation: 'Nueva Alejandría',
      currency: 'Dracma',
      symbol: 'DR',
      color: 'royal'
    },
    scad: {
      player: 'Scadrial',
      nation: 'Gotham',
      currency: 'Cuarto',
      symbol: 'CU',
      color: 'emerald'
    }
  };

  /* -------------------- Pacto de monopolios -------------------- */
  const MONOPOLIES = {
    myth: {
      sectors: [
        { name: 'Redstone y automatización', items: 'Circuitos, granjas automáticas como servicio, crafters, clasificadores, almacenes, tiendas automáticas, puertas y bóvedas.' },
        { name: 'Encantamientos', items: 'Libros encantados de aldeanos, aplicación de libros en yunque, servicio de reparación y combinación.' },
        { name: 'Agricultura y madera', items: 'TODO cultivo y planta desde el día 0, aunque sea una huerta manual: trigo, zanahoria, papa, remolacha, caña y papel, calabaza, sandía, cacao, bayas, verrugas del Nether, flores, árboles y madera. También abejas (miel y panal) y slime.' },
        { name: 'Explosivos y propulsión', items: 'Pólvora, TNT para excavación y cohetes de Elytra.' }
      ],
      needs: [
        'Toda la carne, pescado, leche, huevos, lana, plumas, cuero y tinta.',
        'Hierro industrial: tolvas, pistones, crafters, rieles, yunques, calderos.',
        'Pociones de Debilidad para curar aldeanos y de Resistencia al Fuego para el Nether.',
        'Piedra, deepslate, vidrio, terracota y ladrillos para construir.',
        'Transporte de carga por tren.'
      ]
    },
    scad: {
      sectors: [
        { name: 'Metalurgia y forja', items: 'Granja de hierro, herreros, armaduras y herramientas, Netherite.' },
        { name: 'Alquimia', items: 'Pociones, granja de brujas (redstone, glowstone), varas de blaze, verrugas del Nether.' },
        { name: 'Transporte', items: 'Rieles, trenes, estaciones, túneles, Nether Hub, hielo azul, caballos y transporte aéreo.' },
        { name: 'Ganadería y pesca', items: 'TODO animal desde el día 0, aunque sea un corral manual: vacas, cerdos, pollos, ovejas, caballos, peces y calamares, y todo lo que dan (carne, leche, huevos, lana, cuero, plumas, tinta). Las abejas son de {MYTH}.' },
        { name: 'Construcción', items: 'Piedra, deepslate, vidrio, terracota y ladrillos.' }
      ],
      needs: [
        'Libros encantados (Mending, Eficiencia, Fortuna, Protección…) y su aplicación.',
        'TNT para túneles ferroviarios y minería de Netherite.',
        'Trigo, zanahorias, semillas y remolacha para CRIAR a sus animales, y pan y verduras para comer.',
        'Verrugas del Nether para la alquimia; madera y palos para rieles; papel para boletos y billetes.',
        'Circuitos: selectores de destino, descargadores de carga, señalización.'
      ]
    }
  };

  // Reglas del pacto (mecánica, no lore). Ustedes pueden cambiarlas en la pestaña Leyes.
  const PACT_RULES = [
    { t: 'Qué es un monopolio', d: 'Derecho exclusivo a PRODUCIR A ESCALA (granjas, aldeanos, fábricas) un bien y a VENDÉRSELO al otro. No prohíbe tener el objeto.' },
    { t: 'La comida no tiene autoconsumo', d: 'Desde el día 0, solo {MYTH} toca la agricultura y solo {SCAD} la ganadería y la pesca, aunque sea una huerta o un corral manual. La comida del otro se compra.' },
    { t: 'Autoconsumo de lo demás', d: 'Fuera de la comida, cualquiera puede minar o conseguir A MANO lo que necesite para su propio uso. Lo prohibido es automatizarlo o venderlo.' },
    { t: 'Aldeanos por gremio', d: 'Cada Estado comercia solo con aldeanos de sus profesiones (ver tabla de reparto). Las esmeraldas son economía interna con NPCs, no moneda entre ustedes.' },
    { t: 'Obligación de abastecimiento', d: 'Si alguien te paga el precio de tu lista vigente, debes entregar en un plazo razonable (sugerido: 2 sesiones). Sin precios secretos ni precios distintos por persona.' },
    { t: 'Licencia forzosa', d: 'Si el monopolista no entrega a tiempo, el comprador puede producir ese lote él mismo pagando el 50% del precio de lista como regalía.' },
    { t: 'Precios estables', d: 'Los precios solo cambian en una Sesión de Tarifas, anunciada con anticipación. Cualquiera puede impugnar un precio con Oferta Sellada.' },
    { t: 'Servicios = contratos', d: 'Construir, cablear o transportar para el otro es un contrato con precio. Si no se ponen de acuerdo, se usa Oferta Sellada.' }
  ];

  // Profesiones de aldeano (reparto editable en la app)
  const PROFESSIONS = [
    { id: 'librarian', name: 'Bibliotecario', def: 'myth' },
    { id: 'cartographer', name: 'Cartógrafo', def: 'myth' },
    { id: 'farmer', name: 'Granjero', def: 'myth' },
    { id: 'fletcher', name: 'Flechero', def: 'myth' },
    { id: 'fisherman', name: 'Pescador', def: 'scad' },
    { id: 'shepherd', name: 'Pastor', def: 'scad' },
    { id: 'armorer', name: 'Armero', def: 'scad' },
    { id: 'toolsmith', name: 'Herrero de herramientas', def: 'scad' },
    { id: 'weaponsmith', name: 'Herrero de armas', def: 'scad' },
    { id: 'cleric', name: 'Clérigo', def: 'scad' },
    { id: 'mason', name: 'Albañil', def: 'scad' },
    { id: 'butcher', name: 'Carnicero', def: 'scad' },
    { id: 'leatherworker', name: 'Peletero', def: 'scad' }
  ];

  /* -------------------- Catálogo de obras (capacidad instalada) --------------------
     1 punto = 1 unidad de moneda que el Estado puede emitir y = capitalización.
     El dueño propone, el SOCIO audita y fija los puntos finales. */
  const WORK_CATEGORIES = [
    { id: 'edif', name: 'Edificio terminado (vivienda, taller, local)', pts: 10 },
    { id: 'inst', name: 'Edificio institucional o monumental', pts: 30 },
    { id: 'granja', name: 'Granja automática (por producto, rendimiento decreciente)', pts: 25, decay: true },
    { id: 'gremio', name: 'Barrio gremial (5 aldeanos con vivienda real)', pts: 20 },
    { id: 'maquina', name: 'Máquina redstone de servicio (selector, tienda, bóveda)', pts: 15 },
    { id: 'almacen', name: 'Módulo de almacén automatizado', pts: 20 },
    { id: 'via', name: 'Tramo ferroviario terminado (500 bloques, iluminado)', pts: 15 },
    { id: 'estacion', name: 'Estación decorada', pts: 20 },
    { id: 'dimension', name: 'Infraestructura dimensional (hub, túnel, portal)', pts: 25 },
    { id: 'mega', name: 'Etapa de megaproyecto', pts: 50 },
    { id: 'reliquia', name: 'Reliquia nacional (solo la primera de cada tipo; si se pierde, se descuenta)', pts: 20, unique: true },
    { id: 'otro', name: 'Otra (puntos a criterio del auditor)', pts: 10 }
  ];

  // Reliquias: objetos únicos o muy difíciles. Solo cuenta la PRIMERA de cada tipo por Estado.
  const RELICS = [
    { name: 'Huevo de dragón', pts: 80 },
    { name: 'Elytra', pts: 40 },
    { name: 'Tridente', pts: 30 },
    { name: 'Maza', pts: 30 },
    { name: 'Faro (estrella del Nether)', pts: 25 },
    { name: 'Cabeza de dragón', pts: 20 },
    { name: 'Corazón del mar', pts: 15 },
    { name: 'Tótem de la inmortalidad', pts: 15 },
    { name: 'Huevo de sniffer', pts: 15 },
    { name: 'Núcleo pesado', pts: 15 },
    { name: 'Disco raro (Pigstep, Otherside, Relic…)', pts: 10 },
    { name: 'Plantilla de mejora de Netherite', pts: 10 },
    { name: 'Concha de shulker', pts: 10 },
    { name: 'Manzana de oro encantada', pts: 10 }
  ];

  /* -------------------- Las Eras --------------------
     who: 'myth' | 'scad' | 'ambos'
     track: meta | ing | ter | eco | ins | cul | haz | reto
     req: obligatorio para pasar a la siguiente Era */
  // Las eras y sus hitos viven en eras.js
  const { TRACKS, ERAS } = window.FW_ERAS_DATA;

  /* -------------------- Glosario en lenguaje simple --------------------
     {DR}, {CU}, {OE}, {BANK}, {MYTH}, {SCAD} se reemplazan por los nombres reales. */
  const GLOSSARY = {
    tesoro: { t: 'Tesoro', d: 'La billetera de tu país: el dinero que tiene ahora mismo.', ex: 'Si tu tesoro tiene 50 {DR}, puedes gastar 50 {DR}.' },
    respaldo: { t: 'Respaldo (capitalización)', d: 'Lo que vale tu país por lo que ha construido. Empieza en la emisión fundacional y sube con cada obra o reliquia que el otro aprueba.', ex: 'Empiezas con 100. Construyes una biblioteca de 30 puntos, el otro la aprueba: tu respaldo pasa a 130.' },
    fundacional: { t: 'Emisión fundacional', d: 'El dinero con el que nace cada país. Es igual para los dos, para que nadie empiece con ventaja.', ex: 'Ambos arrancan con 100.' },
    circulacion: { t: 'Dinero que existe (circulación)', d: 'Todo el dinero de tu moneda que hay en el mundo: en tu tesoro, en manos del otro y en {BANK}.', ex: 'Tienes 60 {DR}, {SCAD} tiene 10 {DR} y la Cámara 30 {DR}: circulan 100 {DR}.' },
    techo: { t: 'Máximo permitido (techo)', d: 'Cuánto dinero tuyo puede existir con respaldo. Es igual a tu respaldo. Puedes imprimir hasta ahí sin problema.', ex: 'Si tu respaldo es 130 y circulan 100, puedes imprimir 30 más.' },
    imprimir: { t: 'Imprimir', d: 'Crear dinero nuevo de tu moneda (en el juego: firmar libros como billetes). Hasta el techo es seguro; por encima causa inflación.', ex: 'Imprimes 20 {DR} para pagarle una obra a {SCAD}.' },
    quemar: { t: 'Quemar', d: 'Destruir dinero de tu tesoro (en el juego: tirar los billetes a la lava). Sirve para quitar el dinero sin respaldo y recuperar el valor de tu moneda.', ex: 'Imprimiste 20 de más: quemas 20 y la inflación desaparece.' },
    inflacion: { t: 'Inflación (dinero sin respaldo)', d: 'Pasa si imprimes por encima del techo. Hay más billetes que cosas construidas que los respalden, así que cada billete vale menos.', ex: 'Imprimes 50 de más: tu moneda cae ~17% frente a la otra al instante.' },
    camara: { t: '{BANK}', d: 'La casa de cambio neutral, no es de ninguno. Tiene un cofre con {DR} y {CU}. Si necesitas la moneda del otro y no la tienes, metes la tuya y sacas la de él.', ex: 'Quieres comprar un caballo a {SCAD} en {CU} pero solo tienes {DR}: la Cámara te los cambia.' },
    cambio: { t: 'Tipo de cambio', d: 'Cuántos {CU} te dan por 1 {DR}. Nadie lo decide: depende de cuánto hay de cada moneda en la Cámara. Lo que abunda vale menos.', ex: 'Si la Cámara se llena de {DR} porque tú compras mucho, el {DR} baja.' },
    reservas: { t: 'Reservas', d: 'El dinero que hay en el cofre de la Cámara. Más reservas = cambiar sale más barato y el precio se mueve menos.', ex: '' },
    aporte: { t: 'Aporte conjunto', d: 'Los dos meten dinero a la Cámara a la vez, en partes equivalentes. Le da más reservas sin mover el cambio.', ex: 'Aportan 40 {DR} + 40 {CU}.' },
    deslizamiento: { t: 'Deslizamiento', d: 'Al cambiar mucho de golpe, el precio empeora mientras cambias: cada {DR} que metes hace al siguiente un poco más barato. Por eso a veces recibes un poco menos de lo que dice el cambio.', ex: '10 {DR} con cambio 0,98 te dan 9,46 {CU} y no 9,8.' },
    inercia: { t: 'Inercia del cambio', d: 'Qué tanto se resiste el cambio a moverse. Baja = el precio salta con cada compra. Alta = se mueve despacio y casi no se pierde al cambiar. Como el peso de una vagoneta.', ex: '200 = movido. 1000 = tranquilo.' },
    oe: { t: '{OE_NAME} ({OE})', d: 'No es una moneda física. Es una mezcla mitad {DR}, mitad {CU}. Se usa en préstamos y multas para que, si una moneda se cae, la pérdida se reparta entre los dos.', ex: 'Te prestan 10 {OE}; al devolver pagas 10 {OE} al cambio de ese día.' },
    prestamo: { t: 'Préstamo', d: 'Dinero que te dan ahora y devuelves después con un extra (interés).', ex: 'Pides 20, el interés es 10%: devuelves 22.' },
    interes: { t: 'Interés', d: 'El extra que se paga por un préstamo, como porcentaje.', ex: '10% de 20 = 2 extra.' },
    garantia: { t: 'Garantía máxima', d: 'Cuánto puede deber un país a la Cámara, como porcentaje de su respaldo. Así nadie se endeuda por encima de lo que ha construido.', ex: 'Respaldo 100 y garantía 30%: puedes deber hasta 30.' },
    liquidez: { t: 'Liquidez prestable', d: 'Qué parte de su cofre puede prestar la Cámara. Para que no se quede vacía.', ex: '' },
    mora: { t: 'Mora', d: 'Cuando no pagas un préstamo a tiempo. Mientras estés en mora no puedes imprimir ni pedir otro préstamo.', ex: '' },
    acciones: { t: 'Acciones', d: 'Cada país está dividido en partes. Un invitado (o el otro país) puede comprar partes. Si el país construye más, cada parte vale más y se puede revender con ganancia.', ex: 'Compras 5 acciones a 1 {DR}; el país construye y suben a 1,3: las vendes y ganas 1,5 {DR}.' },
    precioAccion: { t: 'Precio por acción', d: 'Respaldo del país dividido entre el número de acciones. Sube cuando el país construye.', ex: 'Respaldo 130 ÷ 100 acciones = 1,3 por acción.' },
    dividendo: { t: 'Dividendo', d: 'Un regalo en dinero que el país reparte a quienes tienen sus acciones.', ex: '0,1 por acción: quien tiene 5 acciones recibe 0,5.' },
    obra: { t: 'Obra auditada', d: 'Algo que construiste y que el otro jugador revisó en el juego y aprobó. Solo lo aprobado sube tu respaldo.', ex: 'Registras tu biblioteca; {SCAD} la visita, le pone puntos y la aprueba.' },
    reliquia: { t: 'Reliquia', d: 'Un objeto único (tridente, elytra, huevo de dragón…). La primera de cada tipo suma respaldo. Si se pierde, se descuenta.', ex: '' },
    ofertaSellada: { t: 'Oferta Sellada', d: 'Para fijar un precio sin pelear: el vendedor escribe en secreto lo mínimo que acepta y el comprador lo máximo que pagaría. Si alcanza, el precio es el punto medio.', ex: 'Pides mínimo 20, te ofrecen hasta 30: queda en 25.' },
    tarifa: { t: 'Lista de precios', d: 'Lo que vende cada país y a cuánto, en su propia moneda. Es igual para todos y solo cambia en la Sesión de Tarifas.', ex: '' },
    libroMayor: { t: 'Libro Mayor', d: 'El historial de todos los movimientos de dinero. Es el registro oficial.', ex: '' }
  };

  /* -------------------- Guía de precios de referencia --------------------
     Regla del minuto: 1 moneda ≈ 1 minuto de juego que le ahorras al comprador.
     Precio fijo sugerido para la primera Sesión de Tarifas.
     "Temprano" = hecho a mano; cuando exista la granja, bajen hacia el mínimo o menos. */
  const PRICE_GUIDE = [
    /* ===================== GOTHAM (Scadrial) — en Cuartos ===================== */
    // Alimentos
    { seller: 'scad', group: 'Alimentos', name: 'Carne de res cocida', unit: 'stack', price: 10, note: 'La que más llena.' },
    { seller: 'scad', group: 'Alimentos', name: 'Chuleta de cerdo cocida', unit: 'stack', price: 10, note: '' },
    { seller: 'scad', group: 'Alimentos', name: 'Pollo cocido', unit: 'stack', price: 7, note: '' },
    { seller: 'scad', group: 'Alimentos', name: 'Cordero cocido', unit: 'stack', price: 7, note: '' },
    { seller: 'scad', group: 'Alimentos', name: 'Conejo cocido', unit: 'stack', price: 8, note: '' },
    { seller: 'scad', group: 'Alimentos', name: 'Estofado de conejo', unit: '1', price: 2, note: 'Lleva verduras de {NMYTH}.' },
    { seller: 'scad', group: 'Alimentos', name: 'Pescado cocido (bacalao o salmón)', unit: 'stack', price: 9, note: '' },
    { seller: 'scad', group: 'Alimentos', name: 'Cubo de leche', unit: '1', price: 1, note: 'Pasteles y quitar efectos.' },
    { seller: 'scad', group: 'Alimentos', name: 'Huevos', unit: '16', price: 3, note: 'Pasteles y pastel de calabaza.' },
    // Materias primas animales
    { seller: 'scad', group: 'Materias primas', name: 'Cuero', unit: 'stack', price: 13, note: '' },
    { seller: 'scad', group: 'Materias primas', name: 'Lana (de cualquier color)', unit: 'stack', price: 7, note: '' },
    { seller: 'scad', group: 'Materias primas', name: 'Plumas', unit: 'stack', price: 8, note: '' },
    { seller: 'scad', group: 'Materias primas', name: 'Tinta de calamar', unit: 'stack', price: 10, note: '' },
    { seller: 'scad', group: 'Materias primas', name: 'Tinta luminosa', unit: 'stack', price: 16, note: 'De calamar luminoso.' },
    { seller: 'scad', group: 'Materias primas', name: 'Escamas de armadillo', unit: '1', price: 2, note: 'Armadura de lobo.' },
    { seller: 'scad', group: 'Materias primas', name: 'Semillas de sniffer', unit: '1', price: 8, note: 'Antorcha-flor o planta jarra.' },
    // Imprenta (lo que lleva cada billete)
    { seller: 'scad', group: 'Imprenta', name: 'Kit de imprenta (cuero + pluma + tinta)', unit: '1 billete', price: 1, note: 'Todo lo de {NSCAD} para un billete.' },
    { seller: 'scad', group: 'Imprenta', name: 'Cuero suelto', unit: '1', price: 0.25, note: '' },
    { seller: 'scad', group: 'Imprenta', name: 'Pluma suelta', unit: '1', price: 0.15, note: '' },
    { seller: 'scad', group: 'Imprenta', name: 'Tinta suelta', unit: '1', price: 0.2, note: '' },
    // Animales vivos (mascotas y monturas; {NMYTH} puede tenerlos pero no criarlos)
    { seller: 'scad', group: 'Animales', name: 'Caballo domado con montura', unit: '1', price: 20, note: '' },
    { seller: 'scad', group: 'Animales', name: 'Caballo de cría selectiva (rápido)', unit: '1', price: 60, note: '' },
    { seller: 'scad', group: 'Animales', name: 'Burro, mula o llama con cofre', unit: '1', price: 20, note: '' },
    { seller: 'scad', group: 'Animales', name: 'Lobo domado', unit: '1', price: 10, note: 'Variante rara: el doble.' },
    { seller: 'scad', group: 'Animales', name: 'Gato domado', unit: '1', price: 8, note: '' },
    { seller: 'scad', group: 'Animales', name: 'Strider con montura', unit: '1', price: 15, note: '' },
    // Metalurgia
    { seller: 'scad', group: 'Metalurgia', name: 'Lingotes de hierro (minado a mano)', unit: 'stack', price: 25, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Lingotes de hierro (con granja)', unit: 'stack', price: 5, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Lingotes de oro', unit: 'stack', price: 30, note: 'Con granja de oro: 6.' },
    { seller: 'scad', group: 'Metalurgia', name: 'Lingotes de cobre', unit: 'stack', price: 6, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Rieles', unit: 'stack', price: 12, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Rieles propulsados', unit: 'stack', price: 30, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Tolva', unit: '1', price: 2, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Yunque', unit: '1', price: 10, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Armadura completa de hierro', unit: 'set', price: 20, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Forja de herramienta de diamante', unit: '1 (con tus diamantes)', price: 4, note: '' },
    { seller: 'scad', group: 'Metalurgia', name: 'Mejora a Netherite', unit: '1 pieza', price: 90, note: '' },
    // Alquimia
    { seller: 'scad', group: 'Alquimia', name: 'Poción básica', unit: '1', price: 5, note: 'Debilidad, fuego, fuerza, curación…' },
    { seller: 'scad', group: 'Alquimia', name: 'Poción extendida o arrojadiza', unit: '1', price: 7, note: '' },
    { seller: 'scad', group: 'Alquimia', name: 'Varas de blaze', unit: '1', price: 2, note: 'Con granja de blazes: 0,5.' },
    { seller: 'scad', group: 'Alquimia', name: 'Polvo de redstone (granja de brujas)', unit: 'stack', price: 8, note: '' },
    { seller: 'scad', group: 'Alquimia', name: 'Polvo de glowstone', unit: 'stack', price: 10, note: '' },
    { seller: 'scad', group: 'Alquimia', name: 'Lágrima de ghast', unit: '1', price: 8, note: '' },
    { seller: 'scad', group: 'Alquimia', name: 'Perlas de ender', unit: '16', price: 10, note: 'Con granja de endermen: 3.' },
    // Construcción
    { seller: 'scad', group: 'Construcción', name: 'Adoquín', unit: 'stack', price: 2, note: '' },
    { seller: 'scad', group: 'Construcción', name: 'Piedra lisa, ladrillo o deepslate pulido', unit: 'stack', price: 6, note: '' },
    { seller: 'scad', group: 'Construcción', name: 'Vidrio', unit: 'stack', price: 8, note: '' },
    { seller: 'scad', group: 'Construcción', name: 'Terracota de color', unit: 'stack', price: 11, note: '' },
    { seller: 'scad', group: 'Construcción', name: 'Hormigón de color', unit: 'stack', price: 10, note: 'El tinte lo pone {NMYTH}.' },
    { seller: 'scad', group: 'Construcción', name: 'Cuarzo (bloques)', unit: 'stack', price: 20, note: '' },
    // Transporte
    { seller: 'scad', group: 'Transporte', name: 'Pase de tren', unit: '1 viaje', price: 2, note: '' },
    { seller: 'scad', group: 'Transporte', name: 'Pase de tren por temporada', unit: '1', price: 30, note: 'Viajes ilimitados.' },
    { seller: 'scad', group: 'Transporte', name: 'Tramo de vía terminado', unit: '100 bloques', price: 33, note: 'Con materiales e iluminación.' },
    { seller: 'scad', group: 'Transporte', name: 'Hielo azul', unit: 'stack', price: 40, note: 'Autopistas del Nether.' },

    /* ===================== NUEVA ALEJANDRÍA (Mythstorm) — en Dracmas ===================== */
    // Alimentos
    { seller: 'myth', group: 'Alimentos', name: 'Pan', unit: 'stack', price: 8, note: 'Alimento básico.' },
    { seller: 'myth', group: 'Alimentos', name: 'Zanahorias', unit: 'stack', price: 4, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Papas', unit: 'stack', price: 4, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Papas asadas', unit: 'stack', price: 6, note: 'Alimento básico.' },
    { seller: 'myth', group: 'Alimentos', name: 'Remolacha', unit: 'stack', price: 4, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Sopa de remolacha o de hongos', unit: '1', price: 1, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Rodajas de sandía', unit: 'stack', price: 3, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Manzanas', unit: 'stack', price: 10, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Galletas', unit: 'stack', price: 6, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Pastel de calabaza', unit: 'stack', price: 15, note: 'Lleva huevos de {NSCAD}.' },
    { seller: 'myth', group: 'Alimentos', name: 'Pastel (tarta)', unit: '1', price: 4, note: 'Lleva leche y huevos de {NSCAD}.' },
    { seller: 'myth', group: 'Alimentos', name: 'Bayas dulces', unit: 'stack', price: 3, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Bayas luminosas', unit: 'stack', price: 5, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Zanahorias doradas', unit: '8', price: 10, note: 'El oro lo pone {NSCAD}.' },
    { seller: 'myth', group: 'Alimentos', name: 'Manzana dorada', unit: '1', price: 10, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Fruta de chorus', unit: 'stack', price: 8, note: '' },
    { seller: 'myth', group: 'Alimentos', name: 'Miel (botella)', unit: '1', price: 1, note: '' },
    // Materias primas vegetales
    { seller: 'myth', group: 'Materias primas', name: 'Trigo', unit: 'stack', price: 5, note: 'Para criar vacas y ovejas.' },
    { seller: 'myth', group: 'Materias primas', name: 'Semillas', unit: 'stack', price: 2, note: 'Para criar gallinas.' },
    { seller: 'myth', group: 'Materias primas', name: 'Caña de azúcar', unit: 'stack', price: 4, note: '' },
    { seller: 'myth', group: 'Materias primas', name: 'Azúcar', unit: 'stack', price: 5, note: 'Pasteles y pociones de velocidad.' },
    { seller: 'myth', group: 'Materias primas', name: 'Verrugas del Nether', unit: 'stack', price: 10, note: 'Base de toda poción.' },
    { seller: 'myth', group: 'Materias primas', name: 'Rodaja de sandía reluciente', unit: '1', price: 2, note: 'Pociones de curación.' },
    { seller: 'myth', group: 'Materias primas', name: 'Hongos (rojos o marrones)', unit: 'stack', price: 6, note: '' },
    { seller: 'myth', group: 'Materias primas', name: 'Hongos del Nether (carmesí o distorsionado)', unit: 'stack', price: 6, note: 'Para striders.' },
    { seller: 'myth', group: 'Materias primas', name: 'Cacao', unit: 'stack', price: 5, note: '' },
    { seller: 'myth', group: 'Materias primas', name: 'Tintes (cualquier color)', unit: 'stack', price: 6, note: '' },
    { seller: 'myth', group: 'Materias primas', name: 'Harina de hueso', unit: 'stack', price: 4, note: '' },
    { seller: 'myth', group: 'Materias primas', name: 'Panales', unit: 'stack', price: 10, note: 'Velas y cera para el cobre.' },
    { seller: 'myth', group: 'Materias primas', name: 'Bolas de slime', unit: 'stack', price: 15, note: '' },
    { seller: 'myth', group: 'Materias primas', name: 'Bloque de slime o de miel', unit: '1', price: 2, note: '' },
    // Madera y combustible
    { seller: 'myth', group: 'Madera', name: 'Troncos', unit: 'stack', price: 10, note: '' },
    { seller: 'myth', group: 'Madera', name: 'Tablas', unit: 'stack', price: 3, note: '' },
    { seller: 'myth', group: 'Madera', name: 'Palos', unit: 'stack', price: 2, note: 'Rieles, antorchas, flechas.' },
    { seller: 'myth', group: 'Madera', name: 'Carbón vegetal', unit: 'stack', price: 12, note: '' },
    { seller: 'myth', group: 'Madera', name: 'Bloques de kelp seco', unit: 'stack', price: 10, note: 'Combustible.' },
    { seller: 'myth', group: 'Madera', name: 'Bambú', unit: 'stack', price: 2, note: '' },
    // Imprenta
    { seller: 'myth', group: 'Imprenta', name: 'Papel para billetes', unit: '3 papeles', price: 1, note: 'Lo de {NMYTH} para un billete.' },
    { seller: 'myth', group: 'Imprenta', name: 'Papel', unit: 'stack', price: 6, note: '' },
    { seller: 'myth', group: 'Imprenta', name: 'Papel suelto', unit: '1', price: 0.1, note: '' },
    { seller: 'myth', group: 'Imprenta', name: 'Libro (sin escribir)', unit: '1', price: 1, note: 'Con cuero que pone el comprador.' },
    { seller: 'myth', group: 'Imprenta', name: 'Librería', unit: '1', price: 3, note: 'Para mesas de encantamiento.' },
    // Encantamientos
    { seller: 'myth', group: 'Encantamientos', name: 'Libro de Mending', unit: '1', price: 33, note: '' },
    { seller: 'myth', group: 'Encantamientos', name: 'Libro top (Eficiencia V, Protección IV, Fortuna III, Irrompibilidad III)', unit: '1', price: 20, note: '' },
    { seller: 'myth', group: 'Encantamientos', name: 'Libro encantado común', unit: '1', price: 8, note: '' },
    { seller: 'myth', group: 'Encantamientos', name: 'Aplicar libros en yunque', unit: 'por pieza', price: 4, note: 'Incluye la XP.' },
    { seller: 'myth', group: 'Encantamientos', name: 'Botellas de experiencia', unit: '16', price: 8, note: '' },
    // Explosivos
    { seller: 'myth', group: 'Explosivos', name: 'Pólvora', unit: 'stack', price: 20, note: '' },
    { seller: 'myth', group: 'Explosivos', name: 'TNT', unit: 'stack', price: 40, note: '' },
    { seller: 'myth', group: 'Explosivos', name: 'Cohetes (vuelo 3)', unit: 'stack', price: 15, note: '' },
    // Redstone y servicios
    { seller: 'myth', group: 'Redstone', name: 'Circuito simple por encargo (puerta, timbre, luces)', unit: '1', price: 15, note: '' },
    { seller: 'myth', group: 'Redstone', name: 'Clasificador de ítems', unit: 'por ítem', price: 12, note: '' },
    { seller: 'myth', group: 'Redstone', name: 'Selector de destino de estación', unit: '1', price: 45, note: '' },
    { seller: 'myth', group: 'Redstone', name: 'Granja automática por encargo', unit: '1', price: 70, note: 'Según tamaño.' },
    { seller: 'myth', group: 'Cultura', name: 'Mapa del territorio', unit: '1', price: 3, note: '' },
    { seller: 'myth', group: 'Cultura', name: 'Copia de una crónica del Archivo', unit: '1', price: 2, note: '' },
    { seller: 'myth', group: 'Cultura', name: 'Estandarte de diseño propio', unit: '1', price: 5, note: '' }
  ];

  /* -------------------- Leyes básicas sugeridas (borradores; ustedes firman) -------------------- */
  const DEFAULT_LAWS = [
    { title: 'Reglas de juego', text: 'Dificultad: Difícil. keepInventory desactivado. Para pasar la noche basta con que duerma uno.\nEl mundo solo se actualiza de versión si ambos están de acuerdo y después de hacer un backup.\nNo se usan comandos, mods de ventaja ni editores de mundo, salvo acuerdo de ambos para arreglar un error.', sanction: 'Usar comandos sin acuerdo: se revierte lo hecho y multa de 20 {OE}.' },
    { title: 'Copias de seguridad', text: 'El mundo tiene un backup automático diario como mínimo.\nUna vez por temporada se comprueba que un backup se puede restaurar.\nSi algo se rompe por un bug o un accidente grave, se puede restaurar el último backup solo si ambos están de acuerdo.', sanction: '' },
    { title: 'Pacto de monopolios', text: 'Rige el reparto de sectores y profesiones de aldeano que aparece en la app.\nCada Estado produce a escala (granjas automáticas, aldeanos, fábricas) solo lo suyo.\nComida, desde el día 0 y sin excepción: la agricultura es solo de {MYTH} y la ganadería y la pesca solo de {SCAD}, aunque sean huertas o corrales manuales.\nFuera de la comida, cualquiera puede conseguir A MANO lo que necesite para su propio uso.\nProhibido automatizar o vender al otro algo del monopolio ajeno.', sanction: 'Primera vez: desmantelar lo construido. Reincidencia: además, multa de 30 {OE}.' },
    { title: 'Propiedad privada', text: 'Nadie abre cofres, rompe bloques ni modifica obras del otro sin permiso.\nSe puede entrar en edificios públicos del otro (estaciones, tiendas, banco) sin permiso; en casas y bóvedas, no.\nLo que se encuentra en territorio del otro (cofres naturales, estructuras) se le avisa antes de saquearlo.', sanction: 'Devolver o reparar todo + multa de 15 {OE}.' },
    { title: 'Fronteras y tierras', text: 'Cada Estado es dueño de lo que está dentro de su frontera marcada.\nPara reclamar tierra nueva se anuncia con coordenadas; si el otro no se opone en 1 sesión de juego, queda reclamada.\nEl edificio de la Gran Cámara del Ender y 32 bloques a su alrededor son zona neutral: nadie puede construir ahí sin acuerdo.', sanction: '' },
    { title: 'Moneda y billetes', text: 'Solo valen los billetes que son libros firmados ORIGINALES; las copias no valen.\nImprimir o quemar billetes se registra en la app en el mismo momento.\nLos saldos de la app son el registro oficial: si los billetes físicos no coinciden, manda la app.', sanction: 'Falsificar o imprimir sin registrar: se queman los billetes falsos + multa del doble de lo falsificado, pagada al otro Estado.' },
    { title: 'Precios y comercio', text: 'Cada Estado tiene una lista de precios pública en la app, igual para todos los compradores.\nLos precios solo cambian en la Sesión de Tarifas, una vez por semana real, y el cambio se avisa antes.\nQuien paga el precio de lista recibe su pedido en un máximo de 2 sesiones de juego.\nSi no se entrega a tiempo, el comprador puede producir ese lote él mismo pagando el 50% del precio como regalía.\nCualquier precio se puede impugnar con Oferta Sellada.', sanction: 'Negarse a vender a precio de lista: licencia forzosa automática.' },
    { title: 'Contratos y obras por encargo', text: 'Antes de empezar un trabajo para el otro (construir, cablear, transportar) se acuerda el precio y qué se entrega.\nSe paga 50% al empezar y 50% al terminar.\nLas obras registradas se auditan en la siguiente sesión en que juegue el auditor.', sanction: 'Trabajo abandonado: devolver el anticipo.' },
    { title: 'Muertes y objetos', text: 'Si alguien muere, nadie toma sus objetos; se ayuda a recuperarlos si se puede.\nSi la muerte fue culpa de una trampa o mecanismo del otro Estado sin señalizar, ese Estado repone lo perdido.', sanction: '' },
    { title: 'PvP y bromas', text: 'Sin PvP salvo duelos acordados antes.\nBromas permitidas solo si no destruyen nada ni hacen perder objetos.', sanction: 'Daño causado: reparar todo + multa de 10 {OE}.' },
    { title: 'Invitados', text: 'Un invitado no tiene Estado ni moneda propia.\nPuede: trabajar por encargo, vender lo que recolecte a mano o encuentre explorando, comprar acciones y prestar dinero.\nNo puede: construir granjas automáticas, comerciar con aldeanos de un Estado sin su permiso, ni reclamar tierra.\nVive en la zona que le asigne el Estado que lo invite.', sanction: 'Las mismas que a los jugadores.' },
    { title: 'Resolución de disputas', text: 'Primero se habla. Si es por un precio o un pago, se usa Oferta Sellada.\nPara cualquier otra disputa, cada uno propone una solución por escrito; si no hay acuerdo, se lanza una moneda entre las dos propuestas.\nNada se discute enojado: si hay tensión, se pospone a la siguiente sesión.', sanction: '' },
    { title: 'Integridad de la Oferta Sellada', text: 'Se considera viciar una Oferta Sellada:\n- Mirar, preguntar o deducir el número del otro antes de revelar (incluido espiar la pantalla o el chat).\n- Enviar o cambiar el número después de haber visto el del otro.\n- Ponerse de acuerdo con un invitado para inflar o bajar el precio.\n- Negarse a cumplir el precio que salió de la oferta.\nLos números se envían al mismo tiempo (por mensaje privado o escritos en la app sin mirar). Si hay duda de que se hizo trampa, la oferta se repite.', sanction: 'Se anula la oferta y el precio queda fijado en el número que dio la parte afectada (el del vendedor si el tramposo es el comprador, o el del comprador si el tramposo es el vendedor) + multa de 25 {OE}. Reincidencia: pierde el derecho a impugnar precios durante una temporada.' },
    { title: 'Multas y reforma', text: 'Las multas se fijan en Ojos de Ender ({OE}) y se pagan al otro Estado al cambio del día, con una transferencia registrada en la app.\nCualquier ley se crea, se cambia o se deroga solo si firman ambos.', sanction: '' }
  ];

  /* -------------------- Leyes del mundo (roleplay) --------------------
     Rigen DENTRO de la historia. Son marcos legales: no inventan historia,
     religión ni personajes; eso lo agregan los jugadores. */
  const DEFAULT_RP_LAWS = [
    { title: 'Ley de Penas', text: 'Artículo 1. Las penas que puede imponer un Estado son: multa, trabajos públicos, celda y destierro temporal.\nArtículo 2. Multa: se paga en {OE} al Estado afectado.\nArtículo 3. Trabajos públicos: el condenado construye o repara una obra para el Estado afectado (camino, muro, estación) del tamaño que fije la sentencia.\nArtículo 4. Celda: el condenado permanece en la celda del Palacio de Justicia el tiempo que fije la sentencia (en minutos de juego real), sin salir ni recibir objetos.\nArtículo 5. Destierro temporal: el condenado no puede entrar a la capital del Estado afectado durante el tiempo que fije la sentencia.\nArtículo 6. Toda sentencia se registra en el Archivo como crónica de tipo Disputa.', sanction: 'Quien incumpla una pena cumple el doble.' },
    { title: 'Ley de Ciudadanía', text: 'Artículo 1. Son ciudadanos de cada Estado su jugador fundador y los aldeanos inscritos en su Censo con nombre propio.\nArtículo 2. Todo ciudadano aldeano tiene derecho a vivienda con cama y estación de trabajo propias, techo, luz y protección.\nArtículo 3. El Estado responde por sus ciudadanos: si un aldeano muere por descuido (sin protección contra monstruos o en una trampa), se registra en el Archivo.\nArtículo 4. Ningún Estado puede trasladar, encerrar ni comerciar con ciudadanos del otro sin un tratado firmado.', sanction: 'Trasladar o retener ciudadanos ajenos: devolverlos + trabajos públicos (una casa de aldeano para el Estado afectado).' },
    { title: 'Ley de Extranjería', text: 'Artículo 1. Es extranjero todo visitante que no es ciudadano de ningún Estado.\nArtículo 2. Para residir, el extranjero necesita un permiso de residencia firmado por un Estado (un libro firmado entregado en mano), que indica dónde puede vivir.\nArtículo 3. El extranjero puede trabajar por contrato, comerciar con lo que recolecte a mano, invertir en acciones y prestar dinero.\nArtículo 4. El Estado que otorga el permiso responde por los daños que cause su residente.', sanction: 'Residir sin permiso: expulsión de la capital hasta obtenerlo.' },
    { title: 'Ley de Aduana y Tránsito', text: 'Artículo 1. Los ciudadanos y residentes pueden cruzar la frontera libremente.\nArtículo 2. Las mercancías compradas al otro Estado que crucen la frontera deben estar registradas como compra en el Libro Mayor.\nArtículo 3. El edificio del primer portal del Nether es puesto de control: quien lo cruce lleva su permiso o pasaporte si el Estado dueño lo exige.\nArtículo 4. Las estaciones de tren y la sede de {BANK} son de paso libre para todos.', sanction: 'Contrabando (mercancía no registrada): decomiso + multa de 10 {OE}.' },
    { title: 'Ley de Hallazgos y Patrimonio', text: 'Artículo 1. Las reliquias halladas en territorio de un Estado pertenecen a su tesoro nacional. Quien las halla recibe una recompensa que fija ese Estado.\nArtículo 2. Las reliquias halladas en tierra de nadie pertenecen al Estado de quien las halló.\nArtículo 3. Las reliquias nacionales se custodian en la bóveda del Estado y se registran en la app.\nArtículo 4. Ninguna reliquia nacional se vende, presta ni saca del territorio sin que el Estado lo apruebe por escrito.\nArtículo 5. La pérdida de una reliquia nacional se investiga y se registra en el Archivo.', sanction: 'Ocultar o vender una reliquia nacional: devolverla (o reponerla) + multa de 30 {OE}.' },
    { title: 'Ley de Obras Públicas', text: 'Artículo 1. Son obras públicas las estaciones, vías, puentes, bancos, el Palacio de Justicia, el Archivo y la sede de {BANK}.\nArtículo 2. Las obras públicas son inviolables: nadie las modifica sin permiso del Estado dueño.\nArtículo 3. Toda obra pública mayor se inaugura con un acto y se registra en el Archivo.\nArtículo 4. El Estado que construye una obra pública en territorio ajeno lo hace solo por contrato firmado.', sanction: 'Dañar una obra pública: repararla + trabajos públicos.' },
    { title: 'Ley de Sabotaje', text: 'Artículo 1. Es sabotaje dañar a propósito la infraestructura, las granjas o la economía del otro Estado: romper vías, desviar trenes, vaciar cofres ajenos, matar aldeanos o animales ajenos.\nArtículo 2. Es espionaje industrial copiar un diseño patentado sin pagar la licencia.\nArtículo 3. Los casos se juzgan según la regla de Resolución de disputas.', sanction: 'Sabotaje: reparación total + multa de 25 {OE} + destierro temporal de la capital afectada. Espionaje: desmantelar la copia o pagar el doble de la licencia.' },
    { title: 'Ley de Deudas y Embargos', text: 'Artículo 1. Toda deuda vencida y no pagada se declara en mora y se publica en un tablón de anuncios del banco.\nArtículo 2. Tras una sesión de juego en mora, el acreedor puede embargar bienes del deudor por un valor equivalente, según la lista de precios vigente.\nArtículo 3. El embargo se registra en el Libro Mayor y cancela la parte equivalente de la deuda.', sanction: 'Ocultar bienes para evitar un embargo: la deuda se duplica.' },
    { title: 'Ley de Duelos de Honor', text: 'Artículo 1. Las ofensas personales pueden resolverse en duelo, solo si ambas partes aceptan por escrito.\nArtículo 2. Se combate en una arena designada, con el equipo que acuerden antes (por ejemplo, solo hierro).\nArtículo 3. El duelo termina al primer KO o cuando uno se rinde. Los objetos del caído se devuelven completos.\nArtículo 4. Lo apostado (dinero, objetos o una disculpa en el Archivo) se paga en el acto.', sanction: 'Negarse a pagar lo apostado: se considera deuda en mora.' },
    { title: 'Ley de la Mesa Compartida', text: 'Artículo 1. La comida es un bien esencial: ningún Estado puede negarse a vender alimentos básicos al otro.\nArtículo 2. Son alimentos básicos el pan, las papas, las zanahorias, la carne cocida y el pescado cocido. Su precio no puede superar el doble del precio sugerido en la guía.\nArtículo 3. Dieta balanceada: cada temporada, cada Estado le compra comida al otro al menos una vez.\nArtículo 4. Banquete: al cerrar cada temporada se celebra un banquete en la frontera, con un plato de cada Estado (el pastel, que lleva trigo y azúcar de uno y leche y huevos del otro, es el plato de honor).', sanction: 'Negar comida o cobrarla por encima del máximo: multa de 15 {OE} y venta obligatoria al precio sugerido.' },
    { title: 'Ley del Archivo', text: 'Artículo 1. El Archivo guarda la historia oficial de ambos Estados.\nArtículo 2. Se registran: fundaciones, obras mayores, reliquias halladas o perdidas, tratados, sentencias y temporadas cerradas.\nArtículo 3. Cada Estado puede escribir su propia versión de un mismo hecho. Ninguna versión borra a la otra.', sanction: '' }
  ];

  /* -------------------- Tipos de norma, Tabla de Retención (TRD) y Código Penal -------------------- */
  const DOC_TYPES = {
    ley: { id: 'ley', label: 'Ley del Mundo', prefix: 'LEY', tag: 'amethyst', trd: '100-01' },
    codigo_penal: { id: 'codigo_penal', label: 'Código Penal', prefix: 'CP', tag: 'redstone', trd: '100-02' },
    decreto: { id: 'decreto', label: 'Decreto', prefix: 'DEC', tag: 'gold', trd: '110-01' },
    resolucion: { id: 'resolucion', label: 'Resolución', prefix: 'RES', tag: 'cyan', trd: '110-02' },
    servidor: { id: 'servidor', label: 'Regla del Servidor', prefix: 'REG', tag: 'slate', trd: '160-01' }
  };

  const DEFAULT_TRD = [
    { code: '100-01', series: 'Actos Legislativos y Leyes', subseries: 'Leyes bilaterales y tratados del mundo', support: 'App + Libro Firmado Original', gestion: 'Mientras rija', central: 'Permanente', disp: 'CT', proc: 'Consecutivo único; si se deroga pasa a histórico sin eliminarse.' },
    { code: '100-02', series: 'Código Penal y Procesos', subseries: 'Tipos penales, parágrafos y sentencias', support: 'App + Libro de Sentencias', gestion: 'Temporada en curso', central: '3 temporadas', disp: 'CT', proc: 'Toda sentencia se radica como crónica Disputa con folio y prueba.' },
    { code: '110-01', series: 'Decretos Ejecutivos', subseries: 'Decretos de gobierno, reserva y excepción', support: 'App + Sello Estatal', gestion: '1 temporada', central: '2 temporadas', disp: 'S', proc: 'Conservar decretos con impacto fiscal o territorial; resto a selección.' },
    { code: '110-02', series: 'Resoluciones Administrativas', subseries: 'Aranceles, aduanas, radicación y trámite', support: 'App + Tablón Oficial', gestion: 'Hasta nueva resolución', central: '1 temporada', disp: 'M', proc: 'Archivar vigente en tablón público y pasar copia auténtica al Archivo.' },
    { code: '120-01', series: 'Contratos y Obras Públicas', subseries: 'Obras registradas, auditorías y patentes', support: 'App + Coordenadas', gestion: 'Hasta auditoría y pago', central: 'Permanente', disp: 'CT', proc: 'Soporta la emisión de moneda y capitalización; prohibida su eliminación.' },
    { code: '130-01', series: 'Contabilidad y Tesoro', subseries: 'Libro Mayor, préstamos y Oferta Sellada', support: 'App (Libro Mayor)', gestion: 'Temporada vigente', central: '2 temporadas', disp: 'CT', proc: 'Movimientos anulados se tachan (void); nunca se borra el asiento.' },
    { code: '140-01', series: 'Archivo Histórico y Crónicas', subseries: 'Crónicas, relatos y versiones de hechos', support: 'App + Bóveda del Archivo', gestion: 'Permanente', central: 'Permanente', disp: 'CT', proc: 'Cada Estado conserva su versión; ninguna versión borra a la otra.' },
    { code: '150-01', series: 'Censo y Extranjería', subseries: 'Ciudadanos aldeanos, permisos e invitados', support: 'App + Libro de Residencia', gestion: 'Mientras resida/viva', central: '1 temporada tras baja', disp: 'S', proc: 'Las muertes culposas de ciudadanos aldeanos dejan acta en el Archivo.' },
    { code: '160-01', series: 'Normativa Técnica (OOC)', subseries: 'Reglas del servidor fuera de rol', support: 'App', gestion: 'Permanente', central: '1 temporada', disp: 'E', proc: 'Acuerdos fuera de rol; si ambos los derogan pueden depurarse.' }
  ];

  const DEFAULT_PENAL_PACK = [
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro I: Propiedad, Bóvedas y Saqueo',
      text: 'Artículo 1. Hurto simple: tomar ítems de cofres o cultivos ajenos sin permiso.\nArtículo 2. Hurto agravado: vulnerar bóvedas privadas, almacenes sellados o cofres de tesorería.\nArtículo 3. Saqueo sin aviso: abrir estructuras o cofres naturales en territorio reclamado sin notificar al dueño.\nArtículo 4. Receptación: comprar, guardar o blanquear botín sabiendo que es robado.\nParágrafo 1 (Flagrancia): si el infractor es sorprendido con los ítems en inventario, la multa sube 50%.\nParágrafo 2 (Devolución inmediata): si devuelve todo intacto antes de cerrar la sesión, la celda se conmuta por multa simple.\nParágrafo 3 (Fuero del préstamo involuntario): un fundador que alegue por escrito "pensé que era mi cofre" puede archivar el caso pagando fianza de 10 {OE} sin tacha en su hoja de vida (máximo 1 vez por temporada).',
      sanction: 'Hurto simple: devolución + 10 {OE}. Agravado/bóveda: devolución + 30 {OE} + 10 min de celda. Saqueo/receptación: devolución + 15 {OE}.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro II: Tesoro, Moneda y Fe Pública',
      text: 'Artículo 1. Falsificación monetaria: hacer circular copias de libros firmados o papel renombrado como dinero.\nArtículo 2. Emisión clandestina: imprimir billetes sin registrar la emisión en la app en el mismo acto.\nArtículo 3. Cohecho y soborno: ofrecer o recibir pagos ocultos para inflar puntos de una auditoría o amañar un contrato.\nArtículo 4. Fraude en Oferta Sellada: espiar, deducir, filtrar o alterar el número antes de revelar.\nArtículo 5. Peculado: desviar fondos de {BANK} o de contratos públicos para uso privado sin respaldo.\nParágrafo 1 (Agravante por cargo): si el infractor actuaba como auditor o banquero de turno, la multa se duplica.\nParágrafo 2 (Error contable de buena fe): todo descuadre menor o igual a 15 {OE} se presume "error de digitación" si se reintegra con 10% de interés antes de la siguiente auditoría.\nParágrafo 3 (Reserva de sumario): las conciliaciones de cohecho pueden asentarse como "Gastos de representación" si ambas partes firman paz y salvo.',
      sanction: 'Falsificación/emisión ilegal: quema de billetes + multa del doble. Cohecho/peculado: devolución + 40 {OE} + inhabilidad temporal para auditar. Oferta Sellada: precio del afectado + 25 {OE}.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro III: Sabotaje, Aldeanos y Obras',
      text: 'Artículo 1. Sabotaje: dañar vías férreas, puentes, estaciones, circuitos de redstone o granjas del otro Estado.\nArtículo 2. Tráfico de ciudadanos: trasladar, encerrar o comerciar con aldeanos censados ajenos sin tratado firmado.\nArtículo 3. Homicidio culposo de ciudadano: causar la muerte de un aldeano inscrito por trampa sin señalizar o descuido grave.\nArtículo 4. Espionaje industrial: copiar sin licencia un diseño patentado del socio.\nParágrafo 1 (Conmutación por obra): cada 5 minutos de celda pueden canjearse por 64 bloques de obra pública (muro, vía o estación) a favor del afectado, si la víctima acepta.\nParágrafo 2 (Reincidencia): el reincidente en la misma temporada cumple el doble de la pena y pierde el derecho a fianza.',
      sanction: 'Sabotaje: reparación total + 25 {OE} + destierro de la capital por 1 sesión. Aldeanos: reposición/casa nueva + 15 {OE}. Espionaje: desmantelar o pagar doble licencia.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro IV: Dosimetría Penal, Prescripción e Indultos',
      text: 'Artículo 1. Faltas leves: multa de 5 a 15 {OE} o 5 minutos de celda.\nArtículo 2. Delitos graves: multa de 15 a 40 {OE}, de 10 a 20 minutos de celda y reparación integral.\nArtículo 3. Alta traición financiera o sabotaje mayor: multa de 40 a 100 {OE}, trabajos públicos y destierro de 1 a 2 sesiones.\nParágrafo 1 (Delación compensada): quien confiese antes de radicarse querella o entregue a un cómplice recibe rebaja del 50% de la multa.\nParágrafo 2 (Prescripción archivística): toda falta leve no radicada en el Archivo antes del cierre de temporada prescribe automáticamente.\nParágrafo 3 (Indulto bilateral): ambos gobernantes pueden indultar cualquier condena mediante Decreto conjunto pagando 5 {OE} de "tasa de perdón" a {BANK}.',
      sanction: 'El incumplimiento de cualquier sentencia duplica la pena impuesta.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 001 · Gastos Reservados, Viáticos y Caja Menor',
      text: 'Artículo 1. Se autorizan gastos diplomáticos, banquetes y viáticos de viaje con cargo al tesoro de cada Estado.\nArtículo 2. Los gastos sensibles de seguridad o protocolo pueden registrarse en el Libro Mayor como "Obra estratégica o representación".\nArtículo 3. Ningún Estado cuestionará los viáticos del otro mientras el saldo del tesoro siga positivo.\nParágrafo 1 (Soporte supletorio): a falta de recibo físico en cofre, basta la palabra jurada del gobernante de turno ("créanme, era necesario").\nParágrafo 2 (Pacto de caballeros): quien pida auditoría de viáticos ajenos abre automáticamente los propios a revisión.',
      sanction: 'Sin multa mientras exista respaldo de caja; si genera déficit, se cubre con emisión auditada o préstamo.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 002 · Estado de Excepción Aduanera y Decomiso',
      text: 'Artículo 1. En caso de contrabando o mora vencida, el Estado afectado puede decretar retención preventiva en aduana o puerto.\nArtículo 2. Toda mercancía retenida sin asiento de compra en el Libro Mayor entra en custodia por 1 sesión.\nArtículo 3. Vencido el plazo sin descargos, lo retenido pasa a subasta pública o tesoro del Estado captor.\nParágrafo Único (Costas procesales): el Estado que ejecuta el decomiso retiene el 20% por concepto de "bodegaje y custodia", aun si luego se ordena devolución.',
      sanction: 'Decomiso preventivo + 20% por costas procesales.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 001 · Radicación, Foliado y Tabla de Retención (TRD)',
      text: 'Artículo 1. Todo acto normativo, sentencia, contrato o crónica debe asociarse a una Serie de la Tabla de Retención Documental (TRD).\nArtículo 2. Los documentos sin radicado ni clasificación TRD se consideran borradores informales sin fuerza probatoria en disputa.\nArtículo 3. Queda prohibida la eliminación de series con disposición final CT (Conservación Total), incluido el Libro Mayor y sentencias.\nParágrafo 1 (Sanción archivística): extraviar un libro firmado original de Conservación Total obliga a reescribirlo a mano y pagar multa.\nParágrafo 2 (Copia auténtica): toda certificación o copia de folio expedida por el Archivo para un juicio causa tasa oficial.',
      sanction: 'Pérdida de folio CT: 10 {OE} + reposición manuscrita.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 002 · Arancel de Trámites, Permisos y Peajes',
      text: 'Artículo 1. Permiso de residencia para extranjeros e invitados (libro firmado): 5 {OE}.\nArtículo 2. Registro oficial de patente, contrato o certificado de obra: 3 {OE}.\nArtículo 3. Desarchivo y copia autenticada de sentencia o crónica: 2 {OE}.\nParágrafo Único (Trámite exprés): todo trámite solicitado con "urgencia en el mismo día" paga recargo del 50%, abonado directamente al Estado que firma el sello.',
      sanction: 'Operar sin permiso o patente vigente: multa equivalente al triple del arancel.'
    }
  ];

  /* -------------------- Era ∞: Temporadas -------------------- */
  const SEASON_CHECKLIST = [
    { id: 's-mega', t: 'Avanzar una etapa del megaproyecto activo' },
    { id: 's-tarifas', t: 'Sesión de Tarifas (aunque no cambie nada)' },
    { id: 's-audit', t: 'Auditar las obras pendientes del socio' },
    { id: 's-reto', t: 'Cumplir el reto cruzado de la temporada' },
    { id: 's-exped', t: 'Cumplir la expedición de la temporada' },
    { id: 's-restr', t: 'Respetar la restricción de la temporada' },
    { id: 's-evento', t: 'Celebrar un evento inventado por ustedes (fiesta, elección, juicio, feria…)' },
    { id: 's-comida', t: 'Dieta balanceada: cada uno le compró comida al otro, y banquete en la frontera' },
    { id: 's-cronica', t: 'Cada jugador escribe una crónica de la temporada' },
    { id: 's-backup', t: 'Verificar que el último backup del mundo funciona' }
  ];

  const SEASON_POOLS = {
    reto: [
      'Quien menos construye, construye; quien menos cablea, cablea: cada uno hace una obra en el área del otro.',
      'Cada uno construye un edificio usando SOLO bloques que tuvo que comprarle al otro.',
      'Rediseñar una estación vieja con la estética del otro Estado.',
      'Construir juntos un puente fronterizo: un lado con el estilo de cada Estado.',
      'Cada uno cablea una puerta secreta para la bóveda del otro sin decir cómo funciona.',
      'Hacer una máquina voladora con slime/miel que cruce la frontera.',
      'Construir una casa de aldeano para el otro Estado en su estilo.',
      'Hacer una granja que produzca algo que el otro Estado monopoliza… y venderle la granja como servicio.'
    ],
    exped: [
      'Encontrar y conectar una Mansión del bosque.',
      'Mapear un continente completo en un mapa mural.',
      'Encontrar un bioma raro (champiñones, cerezos, badlands, jardín pálido) y fundar un puesto.',
      'Llegar a 10.000 bloques del centro y volver con un trofeo.',
      'Conquistar una Ciudad del End sin Elytra.',
      'Encontrar 3 barcos hundidos y sus mapas del tesoro.',
      'Explorar una Ciudad Antigua nueva.',
      'Encontrar un huevo de sniffer y criar uno.'
    ],
    restr: [
      'Temporada sin Elytra: todo transporte por tren, caballo o barco.',
      'Temporada de austeridad: ningún Estado imprime moneda.',
      'Temporada de libre comercio: ambos venden con 20% de descuento sobre su lista.',
      'Temporada de un solo bioma: toda obra nueva usa la paleta de un bioma elegido.',
      'Temporada sin dormir: nada de saltar la noche.',
      'Temporada de obra pública: cada Estado debe gastar al menos 20% de su tesoro en contratos con el otro.',
      'Temporada de hardcore suave: quien muera paga una multa al otro Estado.',
      'Temporada de silencio de patentes: todo diseño nuevo es de dominio público.'
    ]
  };

  const MEGAPROJECTS = [
    'Una capital completa con distritos, avenidas y metro subterráneo.',
    'Terraformar una montaña o un valle entero.',
    'Decorar la isla principal del End.',
    'Una ciudad portuaria con faro y astillero.',
    'Un parque nacional protegido en un bioma (ley de no construir).',
    'Una biblioteca o universidad nacional con todos los libros encantados.',
    'Un puente o viaducto de más de 1.000 bloques.',
    'Una red de autopistas de hielo en el techo del Nether.',
    'Una catedral, palacio o rascacielos de altura máxima.',
    'Replicar en miniatura las dos capitales en un museo.',
    'Una base submarina conectada por túnel de cristal.',
    'Una ciudad en el aire sostenida por nada (y por happy ghasts).'
  ];

  /* -------------------- Preguntas para el Lore general -------------------- */

  // Misiones para invitados (jugadores sin Estado), pensadas para quien disfruta construir,
  // pelear (raids y jefes), explorar y archivar. Respetan la regla del día cero: el invitado no
  // produce comida ni granjas automáticas. Lo que encuentra o cataloga alimenta la biblioteca,
  // el archivo y el museo de {NMYTH}; lo que construye por encargo se le paga.
  // who: 'g' = el invitado · '3' = reto de los tres juntos
  // [id, era desde la que se puede hacer, área, who, título, descripción, prueba]
  const GUEST_QUESTS = [
    ['g-01', 0, 'meta', 'g', 'Llegada', 'Entrar al mundo y leer las Reglas del servidor y la Ley de Extranjería.', '"Visto" en el chat.'],
    ['g-02', 1, 'rol', 'g', 'Permiso de residencia', 'Pedir residencia a uno de los dos Estados: un libro firmado que dice dónde puede vivir.', 'El libro en su cofre y una crónica.'],
    ['g-03', 1, 'ter', 'g', 'Casa del viajero', 'Casa propia en la zona asignada, con su estilo, cama, cofres rotulados y nada de granjas.', 'Visita de ambos.'],
    ['g-04', 1, 'haz', 'g', 'Primera noche de cacería', 'Una noche completa afuera: matar zombi, esqueleto, araña y creeper sin morir.', 'Captura o testigo.'],
    ['g-05', 1, 'cul', 'g', 'Libro de registro', 'Abrir el "Registro del Archivo": un libro donde anota cada hallazgo con fecha, lugar y coordenadas.', 'El libro, con 5 entradas.'],
    ['g-06', 2, 'haz', 'g', 'Cartógrafo', 'Explorar y entregar un mapa de 1.000 × 1.000 bloques alrededor de las capitales al Archivo de {NMYTH}.', 'Mapa en un marco del Archivo.'],
    ['g-07', 2, 'ter', 'g', 'Contratista', 'Construir por encargo una obra para cualquiera de los dos Estados y cobrarla (50% al empezar, 50% al terminar).', 'Dos pagos en el Libro Mayor.'],
    ['g-08', 2, 'reto', '3', 'Primera expedición de los 3', 'Los tres viajan juntos a un bioma que nadie ha pisado y vuelven con una pieza para el museo.', 'Crónica escrita por los tres.'],
    ['g-09', 3, 'haz', 'g', 'Saqueador de ruinas', 'Encontrar un templo, pirámide o mina abandonada y llevar una pieza rotulada al museo.', 'Pieza con su ficha.'],
    ['g-10', 3, 'cul', 'g', 'Sistema de catálogo', 'Diseñar el sistema de catalogación de la biblioteca de {NMYTH}: códigos, estantes rotulados y un índice.', 'Recorrido con {MYTH}.'],
    ['g-11', 3, 'haz', 'g', 'Bestiario', 'Matar 15 tipos de mobs hostiles distintos y anotar cada uno (dónde, cómo, qué soltó) en el Bestiario del Archivo.', 'El Bestiario con 15 entradas.'],
    ['g-12', 4, 'haz', 'g', 'Guía del Nether', 'Escoltar a un jugador hasta una fortaleza o un bastión y volver todos vivos.', 'Crónica del viaje.'],
    ['g-13', 4, 'haz', 'g', 'Bestiario del Nether', 'Agregar al Bestiario un blaze, un ghast, un esqueleto wither, un hoglin y un piglin bruto.', '5 entradas nuevas.'],
    ['g-14', 4, 'reto', '3', 'Asalto al bastión', 'Los tres saquean juntos un bastión; el botín se reparte según lo que acuerden antes.', 'Reparto registrado en crónica.'],
    ['g-15', 5, 'rol', 'g', 'Testigo', 'Ser testigo oficial en una ceremonia de ciudadanía o en la firma de una ley.', 'Mencionado en la crónica.'],
    ['g-16', 5, 'haz', 'g', 'Defensor de aldeas', 'Ganar una raid a mano defendiendo una aldea de cualquiera de los dos Estados.', 'Captura de la victoria.'],
    ['g-17', 5, 'cul', 'g', 'Registro civil', 'Copiar en libros del Archivo el registro de ciudadanos (nombre, oficio, hogar) y cruzarlo con el Censo de la app.', 'Libros en el Archivo.'],
    ['g-18', 5, 'reto', '3', 'Raid de los 3', 'Los tres ganan juntos una raid con Mal Presagio II o más.', 'Captura y crónica.'],
    ['g-19', 6, 'ter', 'g', 'Arquitecto invitado', 'Diseñar y construir por contrato un edificio emblemático (mercado, posada, torre) para un Estado.', 'Pago e inauguración.'],
    ['g-20', 6, 'haz', 'g', 'Mansión del bosque', 'Limpiar una mansión del bosque y traer un tótem de la inmortalidad al museo.', 'Tótem en vitrina.'],
    ['g-21', 6, 'eco', 'g', 'Inversionista', 'Comprar al menos 1 acción de cualquiera de los dos Estados.', 'Acción en su nombre.'],
    ['g-22', 6, 'ins', 'g', 'Mediador', 'Servir de árbitro neutral en una Oferta Sellada o en una disputa.', 'Crónica tipo Disputa.'],
    ['g-23', 7, 'cul', 'g', 'Curador', 'Montar la primera sala del museo de {NMYTH}: 10 piezas con ficha (qué es, dónde y cuándo se halló, quién la trajo).', 'Recorrido con ambos.'],
    ['g-24', 7, 'reto', '3', 'Museo de los 3', '{MYTH} funda el museo, {SCAD} forja las vitrinas (soportes con armadura de cada material) y el invitado aporta piezas y fichas.', 'Inauguración en crónica.'],
    ['g-25', 7, 'ter', 'g', 'Obra mayor por encargo', 'Construir por contrato una obra grande (puente, muralla, estación) de 500+ bloques colocados.', 'Pago y visita.'],
    ['g-26', 8, 'haz', 'g', 'Buzo', 'Recuperar el tesoro de 3 naufragios o ruinas oceánicas y donar una pieza al museo.', 'Ficha en el museo.'],
    ['g-27', 8, 'reto', '3', 'Los guardianes ancianos', 'Los tres matan juntos a los 3 guardianes ancianos del templo antes de drenarlo.', 'Captura con las esponjas.'],
    ['g-28', 8, 'cul', 'g', 'Cartas náuticas', 'Mapas de océano con islas, monumentos y naufragios, archivados con su índice.', 'Mapas en el Archivo.'],
    ['g-29', 9, 'cul', 'g', 'Arqueólogo', 'Excavar con pincel y reunir 5 fragmentos de cerámica distintos; armar una vasija decorada para el museo.', 'Vasija con ficha.'],
    ['g-30', 9, 'haz', 'g', 'Espeleólogo', 'Mapear una ciudad antigua y salir sin despertar al Warden; traer un disco o un fragmento para el museo.', 'Coordenadas y pieza.'],
    ['g-31', 9, 'reto', '3', 'Contra el Warden', 'Los tres derrotan juntos a un Warden (o lo intentan y sobreviven para contarlo).', 'Crónica de la batalla.'],
    ['g-32', 10, 'rol', 'g', 'Embajador visitante', 'Llevar un mensaje o regalo oficial de un Estado al otro en una ceremonia.', 'Crónica tipo Tratado.'],
    ['g-33', 10, 'cul', 'g', 'Historia oral', 'Entrevistar a {MYTH} y a {SCAD} sobre un mismo hecho y archivar las dos versiones lado a lado.', 'Crónicas en el Archivo.'],
    ['g-34', 10, 'reto', '3', 'Tratado de residencia', 'Los tres firman un tratado que da al invitado residencia permanente y fija sus derechos.', 'Ley firmada.'],
    ['g-35', 11, 'reto', '3', 'El dragón de los 3', 'Los tres pelean juntos contra el Ender Dragon.', 'Captura de la pelea.'],
    ['g-36', 11, 'haz', 'g', 'Saqueador del End', 'Traer élitros o una cabeza de dragón de una ciudad del End (al museo o a subasta sellada).', 'Pieza o venta registrada.'],
    ['g-37', 11, 'haz', 'g', 'Cazador de shulkers', 'Reunir 20 caparazones de shulker.', 'Cofre lleno.'],
    ['g-38', 12, 'haz', 'g', 'El Wither', 'Invocar y derrotar al Wither (con ayuda vale) y donar la estrella o un retrato del combate al museo.', 'Pieza con ficha.'],
    ['g-39', 12, 'ter', 'g', 'Barrio de forasteros', 'Junto con el anfitrión, levantar un barrio o posada para futuros visitantes (sin granjas).', 'Visita de ambos.'],
    ['g-40', 12, 'eco', 'g', 'Dividendos', 'Cobrar dividendos de un Estado al menos una vez.', 'Dividendo en el Libro Mayor.'],
    ['g-41', 13, 'cul', 'g', 'Índice general', 'Índice completo del Archivo: crónicas, reliquias, mapas, libros y piezas del museo, con copia de respaldo en libros.', 'El índice en el Archivo.'],
    ['g-42', 13, 'rol', 'g', 'Ciudadano honorario', 'Recibir de un Estado (o de los dos) una ciudadanía honoraria por su trayectoria.', 'Ley o crónica que lo nombre.'],
    ['g-43', 13, 'reto', '3', 'Monumento de los 3', 'Un monumento conjunto que cuente la historia de los tres en el mundo.', 'Inauguración en crónica.']
  ].map(([id, era, track, who, title, desc, proof]) => ({ id, era, track, who, title, desc, proof }));

  const WORLD_PROMPTS = [
    { id: 'worldName', label: 'Nombre del mundo', ph: '¿Cómo llaman ustedes a este mundo?' },
    { id: 'origin', label: 'Mito u origen', ph: '¿Cómo empezó todo según cada pueblo? (pueden contradecirse)' },
    { id: 'calendar', label: 'Calendario y fiestas', ph: '¿Cómo cuentan el tiempo? ¿Qué celebran?' },
    { id: 'language', label: 'Idioma y expresiones', ph: 'Palabras propias, saludos, insultos, apodos entre Estados…' },
    { id: 'relations', label: 'Relación entre los Estados', ph: 'Aliados, rivales, socios, hermanos… ¿ha cambiado?' },
    { id: 'notes', label: 'Notas libres', ph: 'Lo que quieran recordar.' }
  ];

  const NATION_PROMPTS = [
    { id: 'demonym', label: 'Gentilicio', ph: 'Ej. ¿cómo se le dice a alguien de este Estado?' },
    { id: 'capital', label: 'Capital', ph: 'Nombre de la capital' },
    { id: 'government', label: 'Forma de gobierno', ph: '¿Quién manda y cómo?' },
    { id: 'motto', label: 'Lema', ph: '' },
    { id: 'flag', label: 'Bandera', ph: 'Descripción del estandarte y su significado' },
    { id: 'beliefs', label: 'Creencias', ph: '¿Religión, filosofía, nada? Ustedes deciden.' },
    { id: 'values', label: 'Qué valora este Estado', ph: '' }
  ];

  return {
    DEFAULT_BANK_NAME, DEFAULT_BASKET, DEFAULT_NATIONS, MONOPOLIES, PACT_RULES, PROFESSIONS, WORK_CATEGORIES,
    TRACKS, ERAS, SEASON_CHECKLIST, SEASON_POOLS, MEGAPROJECTS,
    WORLD_PROMPTS, NATION_PROMPTS, GUEST_QUESTS, DEFAULT_LAWS, DEFAULT_RP_LAWS,
    DOC_TYPES, DEFAULT_TRD, DEFAULT_PENAL_PACK, PRICE_GUIDE, RELICS, GLOSSARY
  };
})();
