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
      nation: 'Luthadel',
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
    /* ===================== LUTHADEL (Scadrial) — en Cuartos ===================== */
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

  /* -------------------- Leyes del mundo (roleplay — Técnica Legislativa y Archivística Colombiana) --------------------
     Rigen DENTRO de la historia. Estructuradas con Epígrafe, Considerandos,
     Articulado, Parágrafos, Límites de Proporcionalidad y Disposición Final. */
  const DEFAULT_RP_LAWS = [
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Penas y Régimen Sancionatorio Bilateral',
      text: 'EPÍGRAFE: Por la cual se establece el régimen de penas, criterios de dosimetría, ejecución, custodia, garantías procesales y registro archivístico de las sanciones impuestas por los Estados.\nCONSIDERANDO:\n1. Que el ejercicio del poder sancionatorio exige tipicidad previa, proporcionalidad y respeto al debido proceso.\n2. Que resulta necesario precisar los alcances monetarios, territoriales, temporales y documentales de cada sanción para evitar arbitrariedades.\nDISPONE:\nArtículo 1. Clases de penas, gravedad y acumulación.\nLas infracciones se clasifican en leves, graves y gravísimas según el Código Penal vigente. Las penas aplicables son: (a) multa pecuniaria, (b) trabajos públicos, (c) reclusión en celda y (d) destierro temporal.\nParágrafo 1 (Criterios de aplicación): Las faltas leves admiten únicamente multa o trabajos públicos menores; las graves admiten hasta dos penas concurrentes; las gravísimas admiten acumulación motivada de multa, reparación y destierro temporal (máximo 2 sesiones o 60 minutos efectivos).\nArtículo 2. Pena de multa.\nLas multas se tasan en la unidad de cuenta neutral {OE} (Ojo de Ender) y se pagan en su equivalente en {DR} o {CU} al tipo de cambio del Libro Mayor del día de la sentencia.\nParágrafo 1 (Topes y criterios): La multa mínima será de 5 {OE} y la máxima de 150 {OE}, fijada por la autoridad judicial considerando el daño causado, el dolo y la reincidencia.\nParágrafo 2 (Insolvencia y destino): Si el condenado carece de fondos líquidos, la multa se conmuta en trabajos públicos a razón de 64 bloques o 15 minutos de obra por cada 10 {OE}. El 80% de lo recaudado ingresa al tesoro del Estado afectado y el 20% a la reserva de {BANK}.\nArtículo 3. Trabajos públicos.\nConsisten en construir, excavar o reparar una obra de utilidad común para el Estado afectado, proporcional al daño ocasionado y sin exceder 256 bloques colocados o 25 minutos reales por sentencia.\nParágrafo 1 (Supervisión e imposibilidad): El cumplimiento será verificado por un veedor del Estado afectado o el Archivista. Si la obra resulta inviable por falta de materiales imputable al servidor o al terreno, el condenado podrá proponer obra alternativa equivalente o plazo adicional de 1 sesión.\nArtículo 4. Reclusión en celda.\nSe cumple en celda habilitada del Palacio de Justicia por un máximo de 20 minutos contabilizados exclusivamente en tiempo de actividad efectiva dentro del servidor.\nParágrafo 1 (Desconexiones, custodia y apelación): Las desconexiones involuntarias por caída o red suspenden el conteo sin constituir fuga. El Estado custodio debe garantizar alimentos básicos y salida técnica ante bugs o reinicios. Toda reclusión superior a 10 minutos admite recurso de reposición ante el otro Estado o mediación del Archivista.\nArtículo 5. Destierro temporal.\nComprende el perímetro urbano amurallado o demarcado de la capital del Estado afectado y un radio de 100 bloques desde su plaza central, permitiendo la permanencia en otros territorios y rutas rurales externas.\nParágrafo 1 (Control e ingreso accidental): El control se realiza mediante señalización visible y puesto de aduana. El ingreso accidental conlleva advertencia inmediata y 2 minutos para retirarse sin sanción. El tránsito justificado hacia estaciones o {BANK} podrá autorizarse bajo escolta.\nArtículo 6. Acta y registro obligatorio de sentencias.\nToda sentencia ejecutoriada será radicada por el Archivista Oficial (o por el Estado sancionador en su ausencia) en el Archivo Histórico como crónica tipo Disputa bajo la serie TRD 100-02, conteniendo obligatoriamente: (1) identificación del condenado, (2) autoridad sancionadora, (3) infracción cometida, (4) fundamentos fácticos y jurídicos, (5) tipo, dosimetría y duración de la pena, (6) fecha de imposición y cumplimiento, y (7) estado de ejecución (Pendiente / En curso / Cumplida / Apelada).\nArtículo 7 (Disposición final). Debido proceso ante incumplimiento.\nProhíbese la duplicación automática de penas. Ante presunto incumplimiento, se distinguirá entre evasión deliberada e imposibilidad material, caída del servidor o error administrativo, requiriendo descargos previos antes de imponer un agravante proporcional de hasta el 25% adicional.\nVigencia: Rige a partir de su firma bilateral y deroga las disposiciones anteriores que le sean contrarias.',
      sanction: 'Dosimetría según gravedad: Leves (5–15 {OE}), Graves (15–40 {OE} / hasta 10 min celda), Gravísimas (40–150 {OE} / hasta 20 min celda y/o destierro máx. 2 sesiones).'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Ciudadanía y Protección Aldeana',
      text: 'EPÍGRAFE: Por la cual se define la ciudadanía estatal, los derechos de los habitantes aldeanos inscritos en el Censo y la responsabilidad patrimonial por su custodia.\nCONSIDERANDO:\nQue los aldeanos con oficio constituyen población civil protegida y pilar productivo de cada nación.\nDISPONE:\nArtículo 1. Titularidad de la ciudadanía.\nSon ciudadanos de cada Estado su jugador fundador y los aldeanos inscritos en el Censo Oficial de la aplicación con nombre propio (Name Tag) y folio TRD 150-01.\nArtículo 2. Garantías habitacionales mínimas.\nTodo ciudadano aldeano tiene derecho a vivienda techada e iluminada con cama y estación de trabajo propias, quedando prohibido el confinamiento en cubículos 1×1.\nArtículo 3. Responsabilidad objetiva por custodia.\nSi un aldeano censado fallece por descuido evitable (ausencia de iluminación, muros o trampas sin señalizar), el Estado tutor levantará acta de defunción en el Archivo.\nArtículo 4. Intangibilidad interjurisdiccional.\nNingún Estado podrá trasladar, retener ni comerciar con ciudadanos del otro sin tratado bilateral vigente.',
      sanction: 'Traslado o retención sin tratado: restitución inmediata + obra compensatoria de vivienda aldeana para el Estado afectado.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Extranjería, Residencia y Permisos',
      text: 'EPÍGRAFE: Por la cual se regula el ingreso, permanencia, derechos laborales y responsabilidad civil de los jugadores visitantes e invitados.\nCONSIDERANDO:\nQue la participación de invitados y archivistas externos requiere seguridad jurídica y reglas claras de residencia.\nDISPONE:\nArtículo 1. Calidad de extranjero.\nEs extranjero o invitado todo jugador que no detente soberanía sobre ninguno de los dos Estados fundadores.\nArtículo 2. Permiso de residencia.\nPara establecer morada permanente, el extranjero solicitará permiso de residencia mediante Libro Firmado Original expedido por uno de los Estados, indicando coordenadas de su lote.\nArtículo 3. Derechos económicos y archivísticos.\nEl extranjero residente puede celebrar contratos de obra, vender botín obtenido manualmente, adquirir acciones estatales, otorgar préstamos y ejercer funciones de Archivista o Revisor cuando sea designado.\nArtículo 4. Solidaridad por daños.\nEl Estado anfitrión que expida el permiso responde solidariamente por los daños materiales causados por su residente si este incurre en insolvencia.',
      sanction: 'Residencia irregular sin permiso tras requerimiento: suspensión de ingreso urbano hasta formalizar registro TRD 150-01.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Aduana, Fronteras y Tránsito',
      text: 'EPÍGRAFE: Por la cual se regulan los pasos fronterizos, el control aduanero en portales dimensionales y el libre tránsito ferroviario.\nCONSIDERANDO:\nQue el comercio ordenado entre Estados exige trazabilidad contable y servidumbres libres de paso.\nDISPONE:\nArtículo 1. Libre tránsito de personas.\nLos ciudadanos y residentes con permiso vigente transitan libremente por las fronteras terrestres y vías públicas.\nArtículo 2. Trazabilidad mercantil.\nToda mercancía comprada al otro Estado que cruce frontera en lote comercial deberá contar con asiento previo en el Libro Mayor.\nArtículo 3. Puesto de control dimensional.\nEl edificio del primer Portal del Nether constituye puesto aduanero oficial, pudiendo exigirse pasaporte firmado para su cruce.\nArtículo 4. Servidumbre de paso público.\nLas estaciones de tren, vías troncales y la sede de {BANK} gozan de servidumbre de paso libre y neutralidad.',
      sanction: 'Contrabando comercial no registrado en Libro Mayor: retención preventiva en aduana + multa proporcional de 10 {OE}.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Hallazgos, Reliquias y Patrimonio Nacional',
      text: 'EPÍGRAFE: Por la cual se clasifica el patrimonio histórico y las reliquias únicas del mundo y se regula su custodia.\nCONSIDERANDO:\nQue las reliquias no renovables respaldan la memoria histórica y el prestigio estatal.\nDISPONE:\nArtículo 1. Dominio de los hallazgos.\nLas reliquias halladas dentro de territorio demarcado pertenecen al Estado titular, quien reconocerá recompensa al descubridor. Las halladas en tierra no reclamada pertenecen al Estado del hallador (o según pacto de expedición conjunta).\nArtículo 2. Registro e inventario.\nToda reliquia nacional deberá inscribirse en la sección de Obras y Reliquias y custodiarse en bóveda estatal o en el Museo.\nArtículo 3. Inalienabilidad.\nNinguna reliquia declarada patrimonio nacional podrá venderse ni enajenarse fuera del territorio sin autorización bilateral escrita.\nArtículo 4. Acta por pérdida.\nLa destrucción o extravío definitivo de una reliquia obliga a reportarla en la app y asentar acta investigativa en el Archivo.',
      sanction: 'Ocultamiento o enajenación no autorizada de reliquia: restitución íntegra o reposición equivalente + multa de 30 {OE}.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Obras Públicas y Servidumbres',
      text: 'EPÍGRAFE: Por la cual se define la infraestructura pública protegida y las reglas de contratación interjurisdiccional.\nCONSIDERANDO:\nQue vías férreas, puentes, bancos y sedes judiciales sostienen la conectividad de la civilización.\nDISPONE:\nArtículo 1. Bienes de uso público.\nSon obras públicas las estaciones, líneas férreas, puentes troncales, bancos, el Palacio de Justicia, el Archivo Nacional y la sede de {BANK}.\nArtículo 2. Inviolabilidad.\nProhíbese alterar, demoler o intervenir una obra pública sin consentimiento expreso del Estado propietario.\nArtículo 3. Inauguración y folio TRD.\nToda obra mayor inaugurada se registrará en la serie TRD 120-01 con coordenadas y auditoría del socio.\nArtículo 4. Obras en suelo ajeno.\nLa ejecución de infraestructura en territorio del otro Estado requiere contrato previo con alcance y precio definidos.',
      sanction: 'Daño o intervención no autorizada: reparación integral a costa del infractor + trabajos públicos proporcionales.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Protección contra Sabotaje y Propiedad Intelectual',
      text: 'EPÍGRAFE: Por la cual se protege la infraestructura productiva, los circuitos patentados y las rutas logísticas frente a sabotaje o copia no autorizada.\nDISPONE:\nArtículo 1. Tipificación de sabotaje.\nConstituye sabotaje destruir o alterar dolosamente vías, trenes de carga, circuitos de redstone, granjas o semovientes del otro Estado.\nArtículo 2. Patentes técnicas.\nConstituye infracción de propiedad intelectual replicar un mecanismo expresamente patentado e inscrito sin liquidar su licencia vigente.\nArtículo 3. Remisión procesal.\nLas controversias por sabotaje o patentes se tramitarán conforme al Código Penal y la Ley de Penas.',
      sanction: 'Sabotaje: reparación total + multa de 25 {OE}. Infracción de patente: desmonte o pago del doble de la licencia.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Obligaciones, Deudas y Embargos',
      text: 'EPÍGRAFE: Por la cual se regula la exigibilidad de obligaciones vencidas, la declaratoria de mora y el procedimiento de embargo.\nDISPONE:\nArtículo 1. Declaratoria de mora.\nToda obligación crediticia vencida e impaga será declarada en mora en la aplicación y publicada en el tablón de {BANK}.\nArtículo 2. Ejecución por embargo.\nTranscurrida una sesión completa en mora sin acuerdo de pago, el acreedor podrá embargar bienes muebles equivalentes conforme a la lista oficial de precios vigente.\nArtículo 3. Registro de extinción.\nTodo embargo ejecutado se asentará en el Libro Mayor bajo serie TRD 130-01 extinguiendo el saldo equivalente.',
      sanction: 'Ocultamiento fraudulento de bienes para evadir embargo: recargo del 50% al 100% según tasación judicial.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Duelos de Honor',
      text: 'EPÍGRAFE: Por la cual se reglamentan los combates consensuados de honor y sus garantías de devolución de equipo.\nDISPONE:\nArtículo 1. Consentimiento expreso.\nSolo procederá duelo cuando ambas partes suscriban acta previa aceptando lugar, hora, equipamiento y apuesta.\nArtículo 2. Desarrollo y custodia de objetos.\nSe combatirá en arena designada hasta rendición o primer KO. El inventario del vencido se devuelve intacto de forma obligatoria.\nArtículo 3. Exigibilidad de lo apostado.\nEl premio o disculpa pública pactada se cumplirá al finalizar el encuentro.',
      sanction: 'Incumplimiento de lo apostado o retención de inventario del vencido: obligación declarada en mora inmediata.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley de Seguridad Alimentaria y Mesa Compartida',
      text: 'EPÍGRAFE: Por la cual se declara la alimentación básica como bien esencial de interés público y se establece el Banquete de Temporada.\nDISPONE:\nArtículo 1. Suministro obligatorio.\nNingún Estado podrá negar la venta de alimentos básicos al otro ni fijarles precio superior al doble de la Guía de Referencia.\nArtículo 2. Canasta básica protegida.\nIntegran la canasta básica: pan, papa cocida, zanahoria, carne cocida y pescado cocido.\nArtículo 3. Intercambio y banquete de cierre.\nCada temporada ambos Estados realizarán al menos una compra recíproca de víveres y celebrarán banquete fronterizo con pastel oficial.',
      sanction: 'Desabastecimiento injustificado o especulación sobre el tope: multa de 15 {OE} + venta forzosa al precio de guía.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley Orgánica del Archivo Nacional y Memoria Histórica',
      text: 'EPÍGRAFE: Por la cual se organiza el Archivo Nacional, se garantiza la conservación documental y se protege la pluralidad de versiones históricas.\nCONSIDERANDO:\nQue la Ley General de Archivos exige custodia íntegra de los folios históricos y respeto a las fuentes primarias.\nDISPONE:\nArtículo 1. Naturaleza del Archivo.\nEl Archivo Nacional custodia las leyes, actos administrativos, sentencias, inventarios, libros de censo y crónicas de ambos Estados conforme a la TRD.\nArtículo 2. Actos de obligatoria radicación.\nDeberán radicarse sin excepción: fundaciones, inauguraciones de obras, hallazgos o pérdidas de reliquias, tratados, sentencias y cierres de temporada.\nArtículo 3. Principio de pluralidad histórica.\nCada Estado conserva el derecho inalienable de registrar su propia versión de un mismo acontecimiento; ninguna crónica anula o borra la del socio.\nArtículo 4. Custodia del Archivista.\nEl Archivista designado velará por el consecutivo único, la integridad de las series CT (Conservación Total) y la revisión formal de los actos antes de su firma.',
      sanction: 'Alteración o supresión dolosa de folios CT: reposición manuscrita obligatoria en libro físico + multa de 20 {OE}.'
    }
  ];

  /* -------------------- Tipos de acto administrativo, TRD y Pack Jurídico Colombiano -------------------- */
  const DOC_TYPES = {
    ley: { id: 'ley', label: 'Ley del Mundo', prefix: 'LEY', tag: 'amethyst', trd: '100-01' },
    codigo_penal: { id: 'codigo_penal', label: 'Código Penal', prefix: 'CP', tag: 'redstone', trd: '100-02' },
    decreto: { id: 'decreto', label: 'Decreto Ejecutivo', prefix: 'DEC', tag: 'gold', trd: '110-01' },
    resolucion: { id: 'resolucion', label: 'Resolución Administrativa', prefix: 'RES', tag: 'cyan', trd: '110-02' },
    acuerdo: { id: 'acuerdo', label: 'Acuerdo Bilateral', prefix: 'ACU', tag: 'emerald', trd: '110-03' },
    circular: { id: 'circular', label: 'Circular / Instructivo', prefix: 'CIR', tag: 'indigo', trd: '110-04' },
    servidor: { id: 'servidor', label: 'Regla del Servidor (OOC)', prefix: 'REG', tag: 'slate', trd: '160-01' }
  };

  const DEFAULT_TRD = [
    { code: '100-01', series: 'Actos Legislativos y Leyes', subseries: 'Leyes bilaterales y tratados del mundo', support: 'App + Libro Firmado Original', gestion: 'Mientras rija', central: 'Permanente', disp: 'CT', proc: 'Consecutivo único; si se deroga pasa a histórico sin eliminarse.' },
    { code: '100-02', series: 'Código Penal y Sentencias', subseries: 'Tipos penales, parágrafos y fallos ejecutoriados', support: 'App + Libro de Sentencias', gestion: 'Temporada en curso', central: 'Permanente', disp: 'CT', proc: 'Toda sentencia se radica con 7 campos mínimos y folio Disputa.' },
    { code: '100-03', series: 'Expedientes y Autos de Trámite', subseries: 'Requerimientos, descargos, apelaciones y traslados', support: 'App + Buzón de Trámite', gestion: 'Hasta ejecutoria', central: '2 temporadas', disp: 'S', proc: 'Anexar al expediente de la norma o proceso sancionatorio.' },
    { code: '110-01', series: 'Decretos Ejecutivos', subseries: 'Decretos de gobierno, reserva y excepción', support: 'App + Sello Estatal', gestion: '1 temporada', central: '2 temporadas', disp: 'S', proc: 'Conservar decretos con impacto fiscal o territorial; resto a selección.' },
    { code: '110-02', series: 'Resoluciones Administrativas', subseries: 'Aranceles, aduanas, radicación y trámite', support: 'App + Tablón Oficial', gestion: 'Hasta nueva resolución', central: '1 temporada', disp: 'M', proc: 'Archivar vigente en tablón público y pasar copia auténtica al Archivo.' },
    { code: '110-03', series: 'Acuerdos Bilaterales y Actas', subseries: 'Actas de Sesión de Tarifas, límites y concejos', support: 'App + Libro de Actas', gestion: 'Temporada vigente', central: 'Permanente', disp: 'CT', proc: 'Suscripción conjunta de ambos Estados y testigo archivista.' },
    { code: '110-04', series: 'Circulares e Instructivos', subseries: 'Lineamientos técnicos de archivo, foliado y formatos', support: 'App + Tablón de Archivo', gestion: 'Mientras rija', central: '1 temporada', disp: 'M', proc: 'Divulgación obligatoria a ambos Estados e invitados.' },
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
      title: 'Código Penal · Libro I: Patrimonio, Bóvedas y Saqueo',
      text: 'EPÍGRAFE: Por el cual se tipifican los delitos contra el patrimonio privado, reservas estatales y estructuras en territorio reclamado.\nCONSIDERANDO:\nQue la convivencia económica exige garantías claras frente a sustracciones dolosas y límites objetivos para errores involuntarios.\nDISPONE:\nArtículo 1. Hurto simple: tomar ítems de cofres comunes o cultivos ajenos sin autorización previa.\nArtículo 2. Hurto agravado: vulnerar bóvedas privadas, almacenes sellados o tesorerías estatales.\nArtículo 3. Saqueo sin notificación: extraer botín de estructuras naturales dentro de territorio demarcado sin aviso al Estado titular.\nArtículo 4. Receptación: adquirir, ocultar o comercializar bienes con conocimiento de su origen ilícito.\nParágrafo 1 (Flagrancia): Si el infractor es sorprendido con los bienes en inventario, la multa se incrementa en un 50%.\nParágrafo 2 (Restitución voluntaria): Si restituye íntegro antes del cierre de la sesión sin oposición, la celda se sustituye por multa simple.\nParágrafo 3 (Error excusable): Si un fundador demuestra confusión razonable en zona limítrofe y restituye de inmediato, el caso se archiva mediante acta sin anotación disciplinaria (máximo 1 vez por temporada).',
      sanction: 'Hurto simple: restitución + 10 {OE}. Agravado: restitución + 30 {OE} + 10 min celda efectiva. Saqueo/receptación: restitución + 15 {OE}.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro II: Tesoro, Moneda y Fe Pública',
      text: 'EPÍGRAFE: Por el cual se sancionan las conductas que atentan contra la estabilidad monetaria, las auditorías y la transparencia contractual.\nDISPONE:\nArtículo 1. Falsificación monetaria: poner en circulación copias no originales o papel alterado imitando billetes oficiales.\nArtículo 2. Emisión clandestina: acuñar billetes físicos sin registrar el asiento contemporáneo en la aplicación.\nArtículo 3. Cohecho y fraude en auditoría: ofrecer o aceptar dádivas para sobrevalorar puntos de una obra o amañar su aprobación.\nArtículo 4. Fraude en Oferta Sellada: espiar, deducir o modificar el valor ofertado tras conocer la cifra de la contraparte.\nArtículo 5. Peculado: apropiarse o desviar fondos de {BANK} o de contratos públicos sin soporte contable.\nParágrafo 1 (Agravante por investidura): Si el autor obraba como auditor o representante bancario, la sanción pecuniaria aumenta en un 50%.\nParágrafo 2 (Descuadre contable subsanable): Diferencias menores o iguales a 15 {OE} sin dolo acreditado podrán subsanarse antes de la siguiente auditoría con ajuste manual en Libro Mayor.\nVigencia: Rige desde su firma y se archiva bajo serie TRD 100-02.',
      sanction: 'Falsificación/emisión ilegal: destrucción física de billetes + multa del 150% al 200%. Cohecho/peculado: reintegro + 40 {OE} + suspensión para auditar por 1 sesión.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro III: Infraestructura, Aldeanos y Patentes',
      text: 'EPÍGRAFE: Por el cual se protegen las redes de transporte, la población aldeana censada y la propiedad intelectual.\nDISPONE:\nArtículo 1. Sabotaje ferroviario o técnico: dañar rieles, estaciones, mecanismos de redstone o granjas estatales.\nArtículo 2. Tráfico o retención de ciudadanos: mover, encerrar o explotar aldeanos censados del otro Estado sin tratado.\nArtículo 3. Homicidio culposo de ciudadano: causar la muerte de un aldeano inscrito por omisión grave de protección.\nArtículo 4. Usurpación de patente: replicar un circuito inscrito sin licencia vigente.\nParágrafo 1 (Conmutación por obra): Cada 5 minutos de celda podrán conmutarse por 64 bloques de obra pública a favor del afectado si este acepta.\nParágrafo 2 (Reincidencia): La reincidencia dentro de la misma temporada habilita agravante de hasta el 50% sobre la sanción base, previa verificación en el Archivo.',
      sanction: 'Sabotaje: reparación integral + 25 {OE}. Aldeanos: reposición/vivienda + 15 {OE}. Usurpación de patente: desmonte o pago doble de licencia.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Código Penal · Libro IV: Dosimetría, Prescripción, Apelación e Indultos',
      text: 'EPÍGRAFE: Por el cual se fijan las escalas de dosimetría penal, términos de prescripción, recurso de apelación y régimen de indultos.\nDISPONE:\nArtículo 1. Escala de faltas leves: multa entre 5 y 15 {OE} o hasta 64 bloques de trabajo público.\nArtículo 2. Escala de delitos graves: multa entre 15 y 40 {OE}, reparación integral y reclusión entre 5 y 15 minutos efectivos.\nArtículo 3. Escala de delitos gravísimos: multa entre 40 y 150 {OE}, reclusión de hasta 20 minutos efectivos y/o destierro temporal hasta por 2 sesiones.\nArtículo 4. Recurso de reposición y mediación: Toda condena puede apelarse dentro de la misma sesión ante el pleno bilateral o con mediación del Archivista.\nParágrafo 1 (Confesión y colaboración): Quien confiese antes de radicarse acta disciplinaria recibe rebaja del 40% en la multa.\nParágrafo 2 (Prescripción): Las faltas leves no radicadas antes del cierre de la temporada prescriben automáticamente.\nParágrafo 3 (Indulto conjunto): Ambos gobernantes podrán conceder indulto mediante Decreto bilateral con copia al Archivo TRD 100-02.',
      sanction: 'Ejecución sujeta a acta completa de 7 campos en TRD 100-02; prohibida la duplicación automática de penas.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 001 · Régimen de Viáticos, Representación y Caja Menor',
      text: 'EPÍGRAFE: Por medio del cual se reglamentan los gastos diplomáticos, viáticos de expedición y transparencia de caja menor estatal.\nCONSIDERANDO:\nQue las misiones oficiales y banquetes de Estado requieren autorización presupuestal transparente.\nDECRETA:\nArtículo 1. Gastos autorizados: Cada Estado podrá destinar hasta el 10% de su liquidez disponible en caja a viáticos de expedición, ceremonias o premios de ferias.\nArtículo 2. Soporte contable: Todo desembolso deberá asentarse en el Libro Mayor con concepto expreso bajo serie TRD 130-01.\nArtículo 3. Prohibición de déficit oculto: Ningún gasto de representación podrá generar saldo negativo ni sobrepasar el techo de emisión respaldado.\nParágrafo Único (Control recíproco): Cualquier Estado puede solicitar aclaración contable sobre gastos superiores a 20 unidades, quedando obligado a rendir igual informe cuando se le requiera.',
      sanction: 'Gasto sin registro o que exceda respaldo: reversión contable y ajuste en Libro Mayor.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 002 · Control Aduanero, Retención Preventiva y Decomiso',
      text: 'EPÍGRAFE: Por medio del cual se adopta el procedimiento de retención aduanera y custodia de mercancías en disputa.\nDECRETA:\nArtículo 1. Retención preventiva: Ante mercancía comercial sin asiento en Libro Mayor o deuda en mora declarada, el Estado afectado podrá retener los bienes en depósito aduanero.\nArtículo 2. Inventario y custodia: La retención requiere acta inmediata con listado exacto de ítems y plazo de 1 sesión para presentar descargos.\nArtículo 3. Disposición final: Vencido el término sin descargo válido, los bienes pasan a remate por Oferta Sellada para cubrir la deuda o sanción.\nParágrafo Único (Devolución por error): Si el retenido demuestra pago legítimo, la mercancía se devuelve íntegra y sin recargo alguno.',
      sanction: 'Retención arbitraria sin acta de inventario: devolución inmediata + multa de 10 {OE}.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 001 · Manual de Radicación, Foliado y TRD',
      text: 'EPÍGRAFE: Por la cual se establecen los estándares obligatorios de radicación, foliado y clasificación en la Tabla de Retención Documental (TRD).\nCONSIDERANDO:\nQue la organización archivística garantiza memoria institucional, autenticidad probatoria y consulta ágil de los actos administrativos.\nRESUELVE:\nArtículo 1. Requisitos formales de todo acto: Todo proyecto de Ley, Decreto, Resolución, Acuerdo o Circular deberá contener Epígrafe, Considerandos, Articulado y Vigencia, además de su código de serie TRD.\nArtículo 2. Consecutivo y folio: Al radicarse en la aplicación, el documento recibe prefijo y consecutivo único, debiendo transcribirse copia auténtica en Libro Firmado para actos de Conservación Total (CT).\nArtículo 3. Intangibilidad de series CT: Prohíbese eliminar documentos clasificados como CT; si pierden vigencia se marcan como "Derogada" conservando la trazabilidad histórica.\nParágrafo 1 (Sanción archivística): El extravío injustificado de un libro firmado original CT obliga a su reposición manuscrita.\nParágrafo 2 (Revisión previa): Ningún acto normativo de roleplay podrá firmarse sin haber surtido revisión del Archivista cuando exista Revisor designado.',
      sanction: 'Pérdida injustificada de folio CT: reposición manuscrita + 10 {OE}.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 002 · Aranceles de Trámites, Permisos y Certificaciones',
      text: 'EPÍGRAFE: Por la cual se fijan las tarifas administrativas por expedición de permisos de residencia, patentes y copias autenticadas del Archivo.\nRESUELVE:\nArtículo 1. Tarifas oficiales: (a) Expedición de permiso de residencia para extranjeros: 5 {OE}; (b) Registro oficial de patente técnica o concesión: 3 {OE}; (c) Expedición de copia autenticada de sentencia o crónica: 2 {OE}.\nArtículo 2. Exención de trámites internos: Las consultas digitales en la aplicación y los folios de oficio del Archivista no causan tasa.\nParágrafo Único (Trámite prioritario): Las solicitudes marcadas de urgencia dentro de la misma sesión causan recargo del 50% a favor de la entidad expedidora.',
      sanction: 'Operar concesión o residencia sin pago de arancel vigente: requerimiento de regularización + recargo del 100% del arancel.'
    },
    {
      docType: 'circular',
      trdCode: '110-04',
      title: 'Circular 001 · Lineamientos de Revisión Jurídica y Subsanación',
      text: 'EPÍGRAFE: Por medio de la cual el Archivo Nacional imparte instrucciones para la redacción, devolución, subsanación y custodia de los actos administrativos.\nDISPONE:\nArtículo 1. Lista de chequeo archivística: Antes de emitir aval, el Revisor verificará: (a) precisión de moneda y unidades, (b) límites máximos en penas y plazos, (c) autoridad competente, (d) excepciones por fuerza mayor o caída del servidor, y (e) serie TRD asignada.\nArtículo 2. Trámite de devolución: Toda norma devuelta incluirá observaciones artículo por artículo en el Buzón de Trámite. Los Estados ajustarán el título, texto o sanción y la reenviarán a revisión.\nArtículo 3. Vigencia: Rige desde su publicación en el tablón de Normativa.',
      sanction: 'Norma devuelta no subsanada permanece en borrador sin fuerza vinculante.'
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
    ['g-02', 1, 'rol', 'g', 'Permiso de residencia', 'Pedir residencia a uno de los dos Estados: un libro firmado que dice dónde puede vivir e inscrito en TRD 150-01.', 'El libro en su cofre y una crónica.'],
    ['g-03', 1, 'ter', 'g', 'Casa del viajero', 'Casa propia en la zona asignada, con su estilo, cama, cofres rotulados y nada de granjas.', 'Visita de ambos.'],
    ['g-04', 1, 'haz', 'g', 'Purga inicial: 100 hostiles a mano', 'Alcanzar 100 bajas de mobs hostiles (zombis/esqueletos/arañas/creepers) en Estadísticas sin usar granjas automáticas.', 'Captura de Estadísticas → Criaturas (≥100).'],
    ['g-05', 1, 'cul', 'g', 'Libro de registro y foliado', 'Abrir el "Registro del Archivo" con código TRD 140-01: bitácora donde anota cada hallazgo con fecha, lugar y coordenadas.', 'El libro, con 10 entradas foliadas.'],
    ['g-06', 2, 'haz', 'g', 'Cartógrafo continental', 'Explorar y entregar un mapa mural de 2.000 × 2.000 bloques alrededor de las capitales al Archivo de {NMYTH}.', 'Mapas en marcos del Archivo.'],
    ['g-07', 2, 'ter', 'g', 'Contratista', 'Construir por encargo una obra para cualquiera de los dos Estados y cobrarla (50% al empezar, 50% al terminar).', 'Dos pagos en el Libro Mayor.'],
    ['g-08', 2, 'reto', '3', 'Primera expedición de los 3', 'Los tres viajan juntos a 3.000+ bloques buscando un bioma raro y vuelven con una pieza para el museo.', 'Crónica escrita por los tres.'],
    ['g-09', 3, 'haz', 'g', 'Exterminio de 1.000 zombis', 'Alcanzar 1.000 zombis eliminados (o zombis + ahogados/husks) en combate manual sin granjas AFK.', 'Captura de Estadísticas → Criaturas (Zombis ≥ 1.000).'],
    ['g-10', 3, 'cul', 'g', 'Sistema de catálogo y TRD', 'Diseñar el sistema de catalogación archivística de {NMYTH}: series TRD, estantes rotulados, consecutivos y un índice maestro.', 'Recorrido y aval con {MYTH}.'],
    ['g-11', 3, 'haz', 'g', 'Bestiario completo (20 hostiles)', 'Matar 20 tipos de mobs hostiles distintos (incluidos bruja, enderman, phantom, ahogado, esqueleto glacial) y documentarlos en el Bestiario.', 'El Bestiario con 20 entradas.'],
    ['g-12', 4, 'haz', 'g', 'Guía del Nether', 'Escoltar a un jugador hasta una fortaleza y un bastión y volver todos vivos sin usar cohetes ni pociones prestadas.', 'Crónica del viaje.'],
    ['g-13', 4, 'haz', 'g', 'Cacería infernal (250 bajas)', 'Sumar 250 bajas entre blazes, piglins brutos, esqueletos wither, ghasts y hoglins en el Nether.', 'Captura de Estadísticas del Nether.'],
    ['g-14', 4, 'reto', '3', 'Asalto al bastión del Tesoro', 'Los tres saquean juntos un bastión completo sin morir; el botín se reparte según acta previa.', 'Reparto registrado en crónica.'],
    ['g-15', 5, 'rol', 'g', 'Ministro de Fe y Testigo', 'Actuar como testigo oficial y refrendar actas de ciudadanía, juicios o leyes en el Archivo.', 'Mencionado en 3 crónicas o actas.'],
    ['g-16', 5, 'haz', 'g', 'Incursión solitaria (Mal Presagio V)', 'Ganar una raid completa de nivel máximo (Mal Presagio V) a mano defendiendo una aldea sin encerrar aldeanos en huecos.', 'Captura de Héroe de la Aldea nivel V.'],
    ['g-17', 5, 'cul', 'g', 'Registro civil y expediente judicial', 'Transcribir en libros del Archivo el censo completo de ciudadanos y montar el primer expediente modelo de sentencia (7 campos TRD 100-02).', 'Libros en el Archivo.'],
    ['g-18', 5, 'reto', '3', 'Raid de los 3 (Ominosa)', 'Los tres ganan juntos una raid con Mal Presagio V en campo abierto.', 'Captura y crónica.'],
    ['g-19', 6, 'ter', 'g', 'Arquitecto invitado', 'Diseñar y construir por contrato un edificio emblemático (mercado, posada, torre) de 400+ bloques para un Estado.', 'Pago e inauguración.'],
    ['g-20', 6, 'haz', 'g', 'Mansión del bosque en solitario', 'Encontrar y limpiar una mansión del bosque completa sin morir y traer al menos 2 tótems al museo.', 'Tótems en vitrina.'],
    ['g-21', 6, 'eco', 'g', 'Inversionista', 'Comprar al menos 5 acciones de cualquiera de los dos Estados y registrar un contrato de préstamo.', 'Acciones y préstamo en su nombre.'],
    ['g-22', 6, 'ins', 'g', 'Juez de Instrucción y Mediador', 'Revisar leyes en el Buzón de Trámite y servir de árbitro neutral en una Oferta Sellada o disputa.', 'Aval o crónica tipo Disputa.'],
    ['g-23', 7, 'cul', 'g', 'Curador del Museo', 'Montar la primera sala del museo de {NMYTH}: 15 piezas con ficha técnica TRD (qué es, dónde, cuándo, quién la trajo).', 'Recorrido con ambos.'],
    ['g-24', 7, 'reto', '3', 'Museo de los 3', '{MYTH} funda el museo, {SCAD} forja las vitrinas (soportes con armadura de cada material) y el invitado aporta piezas y fichas.', 'Inauguración en crónica.'],
    ['g-25', 7, 'ter', 'g', 'Obra mayor por encargo', 'Construir por contrato una obra grande (puente, muralla, estación) de 1.000+ bloques colocados.', 'Pago y visita.'],
    ['g-26', 8, 'haz', 'g', 'Señor de los Mares', 'Saquear 5 naufragios/ruinas oceánicas, matar 100 ahogados en Estadísticas y conseguir un tridente sin granja.', 'Tridente + captura de Estadísticas.'],
    ['g-27', 8, 'reto', '3', 'Los guardianes ancianos', 'Los tres matan juntos a los 3 guardianes ancianos del templo antes de drenarlo.', 'Captura con las esponjas.'],
    ['g-28', 8, 'cul', 'g', 'Cartas náuticas', 'Mapas de océano con islas, monumentos y naufragios, archivados con su índice.', 'Mapas en el Archivo.'],
    ['g-29', 9, 'cul', 'g', 'Arqueólogo', 'Excavar con pincel y reunir 10 fragmentos de cerámica distintos; armar 3 vasijas decoradas para el museo.', 'Vasijas con ficha.'],
    ['g-30', 9, 'haz', 'g', 'Saqueador de Ciudad Antigua', 'Saquear una Ciudad Antigua completa, traer el disco Otherside/5 y una plantilla de Silencio.', 'Coordenadas y pieza en bóveda.'],
    ['g-31', 9, 'reto', '3', 'Contra el Warden', 'Los tres derrotan juntos a un Warden en combate real (sin atraparlo en torre de bloques fuera de alcance).', 'Crónica de la batalla.'],
    ['g-32', 10, 'rol', 'g', 'Embajador plenipotenciario', 'Llevar un mensaje o tratado oficial de un Estado al otro en ceremonia formal.', 'Crónica tipo Tratado.'],
    ['g-33', 10, 'cul', 'g', 'Historia oral', 'Entrevistar a {MYTH} y a {SCAD} sobre un mismo hecho y archivar las dos versiones lado a lado.', 'Crónicas en el Archivo.'],
    ['g-34', 10, 'reto', '3', 'Tratado de residencia permanente', 'Los tres firman un tratado (ACU/LEY) que da al invitado residencia permanente y fija sus derechos.', 'Ley firmada.'],
    ['g-35', 11, 'reto', '3', 'El dragón de los 3', 'Los tres pelean juntos contra el Ender Dragon y la reviven al menos una vez.', 'Captura de ambas peleas.'],
    ['g-36', 11, 'haz', 'g', 'Saqueador del End', 'Traer 2 élitros y una cabeza de dragón de ciudades del End (sin usar granjas del End).', 'Piezas o venta registrada.'],
    ['g-37', 11, 'haz', 'g', 'Cazador de 100 shulkers', 'Matar 100 shulkers en ciudades del End (Estadísticas) y reunir 50+ caparazones sin granja automática.', 'Captura de Estadísticas + cofres.'],
    ['g-38', 12, 'haz', 'g', 'Doble Wither en arena abierta', 'Invocar y derrotar solo (o con 1 escolta) al Wither bajo tierra sin trampa de bedrock ni techo del Nether.', 'Estrella + captura.'],
    ['g-39', 12, 'ter', 'g', 'Barrio de forasteros', 'Junto con el anfitrión, levantar un barrio o posada de 4+ edificios para futuros visitantes.', 'Visita de ambos.'],
    ['g-40', 12, 'eco', 'g', 'Dividendos', 'Cobrar dividendos de un Estado al menos 3 veces.', 'Dividendos en el Libro Mayor.'],
    ['g-41', 13, 'cul', 'g', 'Índice general (TRD Completo)', 'Índice completo del Archivo: todas las series TRD, crónicas, reliquias, mapas y piezas del museo con respaldo en libros.', 'El índice en el Archivo.'],
    ['g-42', 13, 'rol', 'g', 'Ciudadano honorario', 'Recibir de ambos Estados ciudadanía honoraria por decreto o ley firmada.', 'Ley o decreto vigente.'],
    ['g-43', 13, 'reto', '3', 'Monumento de los 3', 'Un monumento conjunto de gran escala que cuente la historia de los tres en el mundo.', 'Inauguración en crónica.'],
    ['g-44', 5, 'haz', 'g', 'Francotirador: 500 esqueletos y 250 creepers', 'Alcanzar 500 esqueletos y 250 creepers eliminados en Estadísticas mediante exploración y combate nocturno.', 'Captura de Estadísticas → Criaturas.'],
    ['g-45', 6, 'haz', 'g', 'Veterano: 50 días sin morir', 'Mantener el contador "Tiempo desde la última muerte" por encima de 50 días de Minecraft activos en combate y exploración.', 'Captura de Estadísticas → General.'],
    ['g-46', 7, 'haz', 'g', 'Prueba Ominosa: 5 bóvedas ominosas', 'Completar una Trial Chamber entera bajo efecto de Bad Omen (Ominous Trial) y abrir 5 bóvedas ominosas.', 'Captura + botín pesado/trim.']
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
