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
    { t: 'Autoconsumo de lo demás', d: 'Fuera de la comida, cualquiera puede minar o conseguir A MANO lo que necesite para su propio uso mientras no exista la granja de ese producto. Lo prohibido es automatizarlo o venderlo.' },
    { t: 'Cuando hay granja, se compra', d: 'Desde que el otro Estado audita una granja automática de un producto (hierro, oro, slime, madera…), conseguirlo a mano queda bloqueado para todos menos su dueño: se compra en su tienda. El moderador lo vigila solo; el dueño puede dar !permiso. Si la granja se pierde, el bloqueo se levanta.' },
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
     El dueño propone; únicamente el Archivista Auditor Nacional audita y fija los puntos finales. */
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
    obra: { t: 'Obra auditada', d: 'Algo que construiste y que únicamente el Archivista Auditor (NotOutContext) revisó en el juego y aprobó. Sube tu respaldo y valoriza la moneda mientras no se imprima el margen.', ex: 'Registras tu bóveda; el Archivista Auditor la inspecciona, le pone puntos y la aprueba.' },
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

  /* -------------------- Reglas técnicas del servidor (OOC · Fuera de Rol · TRD 160-01) -------------------- */
  const DEFAULT_LAWS = [
    { title: '[OOC] Reglas de juego y versión', text: 'Ámbito: Fuera de rol (OOC). Dificultad: Difícil. keepInventory desactivado. Para pasar la noche basta con que duerma una persona.\nEl mundo solo se actualiza de versión de Minecraft si ambos fundadores están de acuerdo y tras verificar un backup.\nProhibido usar comandos, mods de ventaja (X-Ray, freecam abusiva) o editores de mundo, salvo acuerdo previo para reparar un bug.', sanction: 'Uso no autorizado de comandos: reversión de lo hecho + multa IC equivalente a 20 {OE}.' },
    { title: '[OOC] Copias de seguridad y caídas del servidor', text: 'Ámbito: Fuera de rol (OOC). El servidor mantiene como mínimo un backup automático diario y una prueba de restauración por temporada.\nSi ocurre una caída del servidor, lag grave, desconexión involuntaria o bug de chunks durante una sanción IC (celda, obra o duelo), todo reloj o plazo IC se pausa de inmediato sin perjuicio para la persona afectada.\nSolo se restaura un backup completo por fallo técnico grave si ambos fundadores lo aprueban.', sanction: '' },
    { title: '[OOC] Uso de la app, identidad ("Soy:") y registro', text: 'Ámbito: Fuera de rol (OOC). Cada persona elige su nombre real en el selector "Soy:" al abrir la app para firmar normas, revisar actos (Archivista), auditar obras o registrar trámites.\nLos saldos de la app y Supabase son la fuente de verdad técnica frente a errores de cálculo físico; todo movimiento de dinero o censo debe registrarse en la app en la misma sesión.\nLas cédulas nominales IC (CC para aldeanos y CA para animales/mascotas) se implementan técnicamente en Minecraft mediante Etiquetas de Nombre (Name Tags) crafteables (papel + pepita), copiando el rótulo oficial desde la pestaña Territorio al yunque.', sanction: 'Descuadre contable menor a 15 {OE} sin dolo: ajuste manual transparente en Libro Mayor.' },
    { title: '[OOC] Bloqueo automático por granjas', text: 'Ámbito: Fuera de rol (OOC). Mientras no exista la granja automática de un producto, cualquiera puede conseguirlo a mano para su propio uso (salvo la comida, que es monopolio desde el día 0).\nCuando el Archivista Auditor audita y aprueba en la app una obra de categoría "Granja automática" de un producto del catálogo, conseguir ese producto a mano queda bloqueado para todos menos el dueño de la granja: se compra en su tienda.\nEl moderador del servidor vigila el bloqueo y entrega al dueño lo que se consiga a mano. El dueño puede autorizar excepciones con !permiso <jugador> <producto> [tiempo].\nSi la granja se marca como perdida, el bloqueo se levanta solo. Los bloqueos vigentes se ven en Economía → Obras & Auditoría.', sanction: 'Lo obtenido a mano se entrega al dueño de la granja. Reincidencia en la misma sesión: multa IC de 10 {OE}.' },
    { title: '[OOC] Pacto técnico de monopolios y granjas', text: 'Ámbito: Fuera de rol (OOC). Rige el reparto técnico de granjas automáticas y profesiones de aldeanos configurado en la app.\nComida desde el día 0: agricultura solo {MYTH}; ganadería y pesca solo {SCAD} (incluidas granjas manuales).\nProhibido construir granjas que causen lag severo cerca de las capitales; las granjas extremas (oro, raids, wither skeletons) van al Distrito Industrial Remoto en la Era XII.', sanction: 'Primera vez: desmonte de la granja. Reincidencia: multa IC de 30 {OE}.' },
    { title: '[OOC] Moneda física (Libros Firmados Originales)', text: 'Ámbito: Fuera de rol (OOC). En el juego, solo tienen validez técnica como billete los Libros Escritos Firmados con sello "Original" (no "Copia de original").\nImprimir o quemar billetes en la app debe ir acompañado de la emisión o destrucción física en lava dentro del juego.', sanction: 'Circulación de copias no originales o sin registro en la app: destrucción de ítems + sanción según CCJ Libro II.' },
    { title: '[OOC] Entregas, plazos por sesiones e invitados', text: 'Ámbito: Fuera de rol (OOC). Todo pedido pagado al precio oficial de lista se entrega en un máximo de 2 sesiones reales de juego.\nLos hitos opcionales de invitados en la app nunca bloquean ni suman para desbloquear Eras de los Estados.\nSi una persona muere, nadie toma sus objetos (salvo para guardarlos y devolverlos); si la muerte fue por trampa sin señalizar de otro jugador, ese jugador ayuda a recuperar o reponer.', sanction: 'Incumplimiento de entrega en 2 sesiones: licencia temporal para autoproducir ese lote pagando 50% de regalía.' },
    { title: '[OOC] PvP y bromas fuera de rol', text: 'Ámbito: Fuera de rol (OOC). Sin PvP fuera de duelos o eventos consensuados.\nLas bromas entre amigos solo se permiten si no destruyen construcciones, no matan mascotas/aldeanos ni hacen perder inventario.', sanction: 'Daño por broma: reparación completa + multa IC de 10 {OE}.' },
    { title: '[OOC] Integridad técnica de la Oferta Sellada', text: 'Ámbito: Fuera de rol (OOC). Se prohíbe mirar la pantalla del otro, deducir o cambiar el número después de ver la oferta ajena, o ponerse de acuerdo con terceros para manipular el precio.\nCuando jueguen en PCs distintos, ambos escriben su número y lo envían simultáneamente por mensaje privado o lo revelan juntos.', sanction: 'Anulación de la oferta, fijación al número de la parte afectada y multa IC de 25 {OE}.' },
    { title: '[OOC] Resolución de tensiones OOC', text: 'Ámbito: Fuera de rol (OOC). Cualquier molestia real fuera de rol se habla primero como amigos. Si persiste tensión, se pausa la discusión para la siguiente sesión. Nunca se mezcla un conflicto personal OOC con represalias IC.', sanction: '' }
  ];

  /* -------------------- Leyes del mundo (roleplay — Técnica Legislativa y Archivística de Miscolandia) --------------------
     Rigen DENTRO de la historia. Estructuradas con Epígrafe, Considerandos,
     Articulado, Parágrafos, Límites de Proporcionalidad y Disposición Final. */
  const DEFAULT_RP_LAWS = [
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 001 · Régimen de Convivencia, Sanciones y Reparación Bilateral',
      text: 'EPÍGRAFE: Por la cual se adopta un lenguaje claro, inclusivo y accesible para regular las medidas correctivas, la reparación del daño, el debido proceso y el registro de sentencias entre Nueva Alejandría y Luthadel.\nCONSIDERANDO:\n1. Que toda persona habitante o visitante tiene derecho a conocer con claridad qué conductas afectan la paz común y cómo se resuelven de manera justa y proporcionada.\n2. Que la justicia bilateral prioriza la reparación real, la escucha previa de descargos y la proporcionalidad sobre cualquier castigo excesivo.\nDISPONE:\nArtículo 1. Clasificación de faltas y medidas aplicables.\nLas conductas que alteren la convivencia se clasifican, según el Código de Convivencia, Justicia y Reparación, en leves, graves y gravísimas. Las medidas aplicables son: (a) reparación pecuniaria, (b) servicio comunitario o reconstrucción, (c) detención preventiva en recinto habilitado y (d) restricción temporal de ingreso urbano.\nParágrafo 1 (Proporcionalidad y lenguaje claro): Las faltas leves admiten únicamente reparación económica menor o servicio comunitario breve; las graves admiten hasta dos medidas combinadas; las gravísimas permiten combinar reparación integral, reposición material y restricción temporal de ingreso (máximo 2 jornadas o 60 minutos efectivos).\nArtículo 2. Reparación pecuniaria.\nLas reparaciones económicas se tasan en la unidad neutral {OE} (Ojo de Ender) y pueden cubrirse en {DR} o {CU} al cambio oficial del Libro Mayor en la fecha de la decisión.\nParágrafo 1 (Topes): El monto mínimo será de 5 {OE} y el máximo de 150 {OE}, graduado según el daño material, la intención y los antecedentes.\nParágrafo 2 (Conmutación y destino): Quien no disponga de liquidez podrá conmutar la suma por obra comunitaria a razón de 64 bloques o 15 minutos de labor por cada 10 {OE}. El 80% ingresa al tesoro del territorio afectado y el 20% al fondo de reserva de {BANK}.\nArtículo 3. Servicio comunitario y obra reparadora.\nConsiste en construir, restaurar o adecuar una obra útil para la comunidad afectada, sin superar 256 bloques o 25 minutos efectivos por decisión.\nParágrafo 1 (Veeduría y fuerza mayor): Un delegado del territorio afectado o el Archivista Nacional verificará el cumplimiento. Si faltan materiales por causa ajena a la persona obligada, se concertará una labor equivalente o una prórroga de 1 jornada.\nArtículo 4. Detención en recinto de justicia.\nSe cumple en sala digna y habilitada del Palacio de Justicia hasta por 20 minutos de permanencia efectiva en jornada activa.\nParágrafo 1 (Garantías y reposición): Toda interrupción por fuerza mayor suspende el cómputo sin considerarse evasión. La autoridad garante proveerá víveres básicos y resguardo seguro. Toda medida superior a 10 minutos admite recurso de reposición ante la autoridad par o mediación del Archivista.\nArtículo 5. Restricción temporal de ingreso urbano.\nAbarca únicamente el casco amurallado o demarcado de la capital afectada y un radio de 100 bloques desde su plaza mayor, dejando libre el paso por caminos rurales, rutas férreas y estaciones.\nParágrafo 1 (Señalización e ingreso involuntario): Todo perímetro restringido debe estar visiblemente demarcado. Quien ingrese por error recibirá aviso inmediato y dispondrá de 2 minutos para retirarse sin cargo alguno.\nArtículo 6. Radicación obligatoria de decisiones.\nToda decisión firme será asentada por el Archivista Oficial en el Archivo Nacional (serie TRD 100-02) con siete datos esenciales: (1) persona responsable, (2) autoridad decisora, (3) hecho evaluado, (4) pruebas y fundamentos, (5) medida y duración exacta, (6) fecha de inicio y cumplimiento, y (7) estado (Pendiente / En curso / Cumplida / Revisada).\nArtículo 7 (Disposición final). Prohibición de sanciones automáticas.\nProhíbese duplicar medidas automáticamente. Ante un presunto incumplimiento se oirán descargos previos para distinguir entre evasión deliberada y fuerza mayor.\nConcordancias: Código de Convivencia, Justicia y Reparación (CCJ Libros I–IV, TRD 100-02); Decreto 002 (TRD 110-01); Ley Orgánica del Archivo Nacional (TRD 100-01); Manual 001 (TRD 110-05).\nVigencia: Rige desde su suscripción bilateral, sustituye disposiciones anteriores contrarias y permanece activa sin derogatorias tácitas.',
      sanction: 'Escala clara y proporcional: Leves (5–15 {OE}), Graves (15–40 {OE} o hasta 10 min en recinto), Gravísimas (40–150 {OE}, hasta 20 min y/o restricción urbana máx. 2 jornadas).'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 002 · Ciudadanía, Cédulas (CC/CA) y Protección de Aldeanos y Animales',
      text: 'EPÍGRAFE: Por la cual se reconoce la ciudadanía de las y los habitantes aldeanos, se instituyen las Cédulas Oficiales de Identidad Nominal para aldeanos (CC) y animales o mascotas (CA), y se garantiza su vivienda y trato digno.\nCONSIDERANDO:\n1. Que toda persona y cada habitante aldeano con oficio merece identidad reconocida, techo seguro y respeto integral.\n2. Que los animales de compañía, monturas, guardianes y semovientes valiosos forman parte del hogar y patrimonio vivo de Nueva Alejandría y Luthadel, y pueden portar Cédula Nominal Física desde la base artesanal.\nDISPONE:\nArtículo 1. Ciudadanía y Registro Civil en Cédulas (CC y CA).\nSon habitantes protegidos los fundadores de cada nación, todo ciudadano aldeano portador de su Cédula de Ciudadanía (Serie CC) e inscrito en el Registro Civil bajo serie TRD 150-01, y todo animal o compañero vivo inscrito con Cédula Animal (Serie CA).\nParágrafo 1 (Requisitos mínimos de la Cédula): Toda inscripción en TRD 150-01 asignará código consecutivo único (por ejemplo CC-NA-0001 o CA-LUT-0001), nombre propio, oficio o especie, morada o establo asignado, Estado responsable y constancia de si porta físicamente su rótulo nominal.\nParágrafo 2 (Gratuidad): La expedición de Cédulas CC y CA en el Registro Civil es completamente gratuita y sin arancel estatal.\nArtículo 2. Estándar de vivienda y albergue digno.\nTodo ciudadano aldeano tiene derecho a un hogar techado, cerrado, iluminado contra amenazas nocturnas, con lecho propio y mesa de oficio accesible. Todo animal cedulado tendrá corral, establo o morada segura acorde con su especie.\nParágrafo 1 (Prohibición de hacinamiento): Prohíbese el encierro en cubículos estrechos de 1×1, fosos sin salida o recintos sin cama ni circulación digna.\nArtículo 3. Deber de cuidado y acta de deceso.\nCada Estado responde por la seguridad de sus habitantes y animales cedulados. Si ocurre un fallecimiento por descuido prevenible en iluminación, cercos o trampas sin señalizar, se levantará acta en el Archivo (TRD 150-01) preservando el folio histórico y adoptando medidas correctivas.\nParágrafo 1 (Fuerza mayor): No genera sanción el deceso causado por calamidad imprevista, fenómenos extraordinarios del territorio o asaltos defensivos debidamente documentados.\nArtículo 4. Respeto entre jurisdicciones.\nNinguna nación podrá trasladar, retener ni apropiarse de habitantes aldeanos ni animales cedulados del otro territorio sin acuerdo expreso o tratado bilateral inscrito.\nConcordancias: Código de Convivencia · Libro III (TRD 100-02); Circular 002 de Cédulas Nominales (TRD 110-04); Ley 003 de Hospitalidad (TRD 100-01); Manual 001 (TRD 110-05).\nVigencia: Rige desde su suscripción bilateral y se archiva bajo serie TRD 100-01.',
      sanction: 'Traslado o retención sin acuerdo: retorno inmediato al hogar + reparación de 15 {OE} + edificación de vivienda o establo digno compensatorio.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 003 · Movilidad, Hospitalidad y Residencia para Visitantes',
      text: 'EPÍGRAFE: Por la cual se garantiza el trato respetuoso e incluyente a toda persona visitante, invitada, contratista o archivista, y se regula su residencia y participación económica.\nCONSIDERANDO:\n1. Que quienes visitan el mundo como invitados, constructores, comerciantes o archivistas enriquecen la vida pública y la memoria compartida.\n2. Que el término excluyente debe ceder paso a reglas claras de hospitalidad, deberes comprensibles y participación justa.\nDISPONE:\nArtículo 1. Definición de persona visitante e invitada.\nSe reconoce como visitante o invitada a toda persona libre que ingresa a Nueva Alejandría o a Luthadel sin ejercer jefatura fundacional sobre ninguno de los dos Estados.\nArtículo 2. Carta de Residencia y arraigo territorial.\nQuien desee fijar morada estable solicitará Carta de Residencia en Libro Firmado Original expedido por cualquiera de los Estados, señalando las coordenadas del solar asignado y su registro en la serie TRD 150-01.\nParágrafo 1 (Arancel y vigencia): El trámite causa únicamente la tarifa fijada en la Resolución 002 y conserva validez mientras el titular mantenga su solar en orden.\nArtículo 3. Derechos económicos, laborales y archivísticos.\nToda persona visitante o residente con Carta vigente podrá: (a) suscribir contratos remunerados en {DR} o {CU}, (b) vender bienes y trofeos obtenidos por esfuerzo propio, (c) adquirir participaciones estatales, (d) conceder préstamos formales y (e) ejercer como Archivista Nacional o Revisor Documental.\nParágrafo 1 (Respeto a los monopolios locales): Queda reservada a cada Estado la explotación gremial e industrial autorizada, salvo permiso escrito de la nación anfitriona.\nArtículo 4. Acompañamiento solidario.\nEl Estado anfitrión responde solidariamente por compromisos materiales incumplidos por un residente suyo si este carece de fondos, garantizando siempre escucha previa de descargos.\nConcordancias: Resolución 002 (TRD 110-02); Ley 004 de Fronteras y Aduanas (TRD 100-01); Guía 001 de Bienvenida (TRD 110-05).\nVigencia: Rige desde su firma bilateral y deroga cualquier denominación excluyente anterior.',
      sanction: 'Permanencia sin Carta tras aviso formal: suspensión temporal de comercio urbano hasta radicar inscripción en TRD 150-01.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 004 · Fronteras Abiertas, Aduanas y Servidumbres de Paso',
      text: 'EPÍGRAFE: Por la cual se ordenan los límites territoriales, la circulación libre por vías y estaciones, la trazabilidad aduanera y la neutralidad de los cruces estratégicos.\nCONSIDERANDO:\n1. Que la hermandad comercial entre Nueva Alejandría y Luthadel exige fronteras claras y caminos reales seguros.\n2. Que el tránsito ferroviario, el cruce por portales dimensionales y las operaciones de {BANK} requieren reglas simples y neutrales.\nDISPONE:\nArtículo 1. Circulación libre y respeto a recintos privados.\nHabitantes y visitantes transitan libremente por caminos reales, plazas abiertas, puertos y estaciones entre ambas naciones.\nParágrafo 1 (Recintos privados): El libre tránsito no autoriza el acceso a bóvedas privadas ni recintos señalizados como restringidos sin invitación de su titular.\nArtículo 2. Registro aduanero de lotes comerciales.\nTodo cargamento mercantil adquirido entre Estados que cruce frontera deberá constar en el Libro Mayor Oficial (TRD 130-01). Los enseres personales de viaje quedan exentos de todo trámite aduanero.\nArtículo 3. Estación aduanera del Portal del Nether.\nEl edificio que resguarda el primer Portal del Nether funge como paso aduanero conjunto. Cada Estado podrá solicitar exhibición de salvoconducto o carta de identidad, garantizando paso inmediato ante urgencias médicas, defensivas o de rescate.\nArtículo 4. Zona neutral de {BANK} y líneas troncales.\nLas líneas ferroviarias principales, sus estaciones y la sede central de {BANK} —incluyendo un cinturón de 32 bloques alrededor— constituyen territorio neutral de libre servidumbre.\nConcordancias: Decreto 002 (TRD 110-01); Acuerdo 001 (TRD 110-03); Ley 006 de Obras Públicas (TRD 100-01); Guía 001 (TRD 110-05).\nVigencia: Rige desde su firma bilateral bajo serie TRD 100-01.',
      sanction: 'Tránsito comercial reiterado sin asiento en Libro Mayor: custodia preventiva en aduana (Decreto 002) + reparación de 10 {OE}.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 005 · Hallazgos, Reliquias y Patrimonio Histórico Nacional',
      text: 'EPÍGRAFE: Por la cual se protege el patrimonio arqueológico, cultural y las reliquias irrepetibles del mundo, regulando su custodia, exhibición e inventario oficial.\nCONSIDERANDO:\n1. Que las reliquias irrepetibles resguardan la memoria viva, los museos y la identidad de Nueva Alejandría y Luthadel.\n2. Que es deber común garantizar su conservación transparente y prevenir su extravío silencioso.\nDISPONE:\nArtículo 1. Propiedad y estímulo al descubrimiento.\nToda reliquia hallada en territorio delimitado pertenece al Estado titular, quien reconocerá a quien la descubra (incluida toda persona visitante) una prima justa o tarifa de guía. Las halladas en tierras libres pertenecen al Estado del descubridor o al fondo común de expediciones conjuntas.\nArtículo 2. Inventario en el Catálogo Oficial.\nCada pieza patrimonial debe inscribirse en el Catálogo Oficial de Obras y Reliquias bajo serie TRD 120-01, indicando su recinto de custodia (Bóveda Estatal, Museo Nacional o Edificio Cívico).\nArtículo 3. Protección y circulación autorizada.\nNinguna reliquia declarada patrimonio nacional podrá venderse, cederse ni trasladarse fuera de su territorio sin autorización bilateral escrita o remate transparente en Oferta Sellada.\nArtículo 4. Acta por pérdida o extravío.\nSi una reliquia desaparece en combate, catástrofe o accidente imprevisto, se registrará su novedad en el Catálogo Oficial y se levantará acta investigativa en el Archivo (TRD 140-01).\nConcordancias: Ley 006 de Obras Públicas (TRD 100-01); Ley 011 del Archivo Nacional (TRD 100-01); Manual 002 de Gestión Documental (TRD 110-05).\nVigencia: Rige desde su firma bilateral y deroga las disposiciones anteriores contrarias.',
      sanction: 'Ocultamiento o traslado no autorizado de reliquia nacional: restitución íntegra o reposición equivalente + reparación de 30 {OE}.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 006 · Obras Públicas, Infraestructura y Servidumbres Comunes',
      text: 'EPÍGRAFE: Por la cual se definen los bienes públicos al servicio de la comunidad, su cuidado físico, la verificación entre Estados y la construcción en jurisdicción ajena.\nCONSIDERANDO:\n1. Que la red ferroviaria, los puentes, los bancos, el Palacio de Justicia y el Archivo sostienen la vida diaria de ambas naciones.\n2. Que toda obra pública respalda la moneda común y requiere verificación transparente.\nDISPONE:\nArtículo 1. Bienes al servicio público.\nSon obras de interés común las estaciones ferroviarias, líneas troncales, puentes mayores, puertos, bancos estatales, el Palacio de Justicia, el Archivo Nacional, el Museo y la sede de {BANK}.\nArtículo 2. Cuidado e intervención autorizada.\nNinguna persona o Estado podrá demoler, desviar o alterar una obra pública sin autorización expresa del Estado titular o acuerdo bilateral cuando sea de propiedad compartida.\nArtículo 3. Catastro y verificación recíproca.\nToda obra mayor deberá asentarse en el Catastro Oficial con nombre, categoría, coordenadas y avalúo en puntos (TRD 120-01), surtiendo verificación paritaria para respaldar su valor.\nArtículo 4. Construcción en territorio vecino.\nNingún Estado edificará infraestructura permanente en suelo delimitado del vecino sin contrato previo que precise trazado, servidumbre de paso, precio y responsable de mantenimiento.\nConcordancias: Ley 004 de Fronteras y Servidumbres (TRD 100-01); Ley 007 de Cuidado de Infraestructura (TRD 100-01); Acuerdo 001 (TRD 110-03).\nVigencia: Rige desde su firma bilateral y se archiva bajo serie TRD 100-01.',
      sanction: 'Daño o intervención no autorizada en obra pública: restauración completa por el responsable + servicio comunitario de hasta 128 bloques.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 007 · Cuidado de Infraestructura, Ingeniería y Creaciones Propias',
      text: 'EPÍGRAFE: Por la cual se protege la infraestructura pública y productiva frente a daños deliberados, y se reconoce la autoría de diseños técnicos e invenciones registradas.\nCONSIDERANDO:\n1. Que las obras de redstone, estaciones, cultivos y granjas requieren protección jurídica redactada en términos claros, inclusivos y comprensibles para todos.\n2. Que es fundamental distinguir entre el daño intencional y cualquier incidente fortuito durante una visita o defensa.\nDISPONE:\nArtículo 1. Deber de respeto a la infraestructura.\nEstá prohibido destruir, bloquear o alterar de forma deliberada vías férreas, vagones de carga, mecanismos de redstone, bodegas, cultivos, granjas o rebaños de otro titular.\nParágrafo 1 (Incidentes fortuitos): Quedan libres de culpa los daños accidentales ocurridos por amenaza hostil durante una visita o falla fortuita, siempre que se avise de inmediato y se colabore de buena fe en su arreglo.\nArtículo 2. Registro de diseños e invenciones (Patentes).\nTodo circuito de redstone, sistema de estación o arquitectura singular inscrito como creación propia mediante Acuerdo o Resolución otorga reconocimiento y exclusividad de uso a su autor.\nParágrafo 1 (Licencias justas): Quien desee replicar una invención registrada acordará previamente una licencia justa con su titular; a falta de acuerdo en el valor, se definirá mediante Oferta Sellada.\nArtículo 3. Trámite reparador.\nToda reclamación se resuelve conforme al Código de Convivencia, Justicia y Reparación y a la Ley 001, garantizando derecho de escucha y registro archivístico.\nConcordancias: Código de Convivencia · Libro III (TRD 100-02); Ley 006 de Obras Públicas (TRD 100-01); Resolución 002 de Aranceles (TRD 110-02); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bilateral y sustituye cualquier denominación punitiva anterior.',
      sanction: 'Daño deliberado a infraestructura: reparación total + 25 {OE} + restricción urbana hasta 1 jornada. Uso no autorizado de patente: retiro o pago doble de licencia.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 008 · Contratos de Crédito, Obligaciones y Cobro Proporcional',
      text: 'EPÍGRAFE: Por la cual se establecen reglas comprensibles sobre plazos de pago, declaratoria formal de atraso y entrega tasada de garantías ante deudas incumplidas.\nCONSIDERANDO:\n1. Que el crédito entre naciones y con {BANK} funciona mejor cuando las obligaciones y garantías se conocen desde el primer día.\n2. Que ningún cobro debe privar a una persona o Estado de sus medios esenciales de subsistencia.\nDISPONE:\nArtículo 1. Exigibilidad y constancia de mora.\nVencido el plazo de un préstamo sin pago ni prórroga escrita, el acreedor o {BANK} asentará la constancia de mora en el Libro Mayor del Registro Oficial.\nParágrafo 1 (Efecto preventivo): Mientras exista mora vigente, el Estado deudor suspenderá nuevas emisiones monetarias y nuevos créditos ante {BANK}.\nArtículo 2. Plazo de arreglo y cobro sobre bienes disponibles.\nNotificada la mora, la parte deudora cuenta con 1 jornada completa para presentar un plan de pago viable. Vencido ese plazo sin acuerdo, el acreedor podrá recibir bienes muebles no esenciales equivalentes al saldo pendiente, avaluados según la Guía Oficial de Precios.\nParágrafo 1 (Bienes protegidos e inembargables): Nunca pueden retenerse billetes originales pertenecientes a terceros, equipo personal en uso, alimentos básicos de subsistencia ni reliquias nacionales registradas.\nArtículo 3. Cierre contable obligatorio.\nTodo arreglo o entrega de bienes deberá quedar asentado en el Libro Mayor (TRD 130-01), precisando bienes recibidos, valor aplicado y paz y salvo total o parcial.\nConcordancias: Decreto 001 de Caja Menor (TRD 110-01); Decreto 002 de Aduanas (TRD 110-01); Código de Convivencia · Libro II (TRD 100-02).\nVigencia: Rige desde su firma bilateral bajo serie TRD 100-01.',
      sanction: 'Ocultamiento deliberado de garantías tras mora firme: recargo proporcional del 25% al 50% previa acta de descargos.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 009 · Torneos, Justas y Duelos de Honor',
      text: 'EPÍGRAFE: Por la cual se reglamentan los retos caballerescos, justas y duelos pactados de honor, garantizando seguridad, imparcialidad y devolución íntegra de pertenencias.\nCONSIDERANDO:\n1. Que las diferencias de honor o los encuentros deportivos pueden tramitarse en arena segura mediante reglas transparentes.\nDISPONE:\nArtículo 1. Consentimiento libre y acta previa.\nTodo duelo o justa requiere aceptación previa y expresa de quienes participan, precisando fecha, arena autorizada, equipo permitido (por ejemplo, acero básico sin brebajes) y compromiso pactado.\nArtículo 2. Reglas de encuentro y custodia de pertenencias.\nEl encuentro finaliza por rendición o primer abatimiento. Ningún participante podrá dañar, ocultar ni retener pertenencias caídas de su contrincante, las cuales se entregarán íntegras en cofre neutral al término.\nArtículo 3. Cumplimiento del compromiso.\nLa recompensa económica, objeto acordado o gesto de reconciliación se cumplirá dentro de la misma jornada; de lo contrario se asentará obligación pendiente.\nParágrafo Único (Juez neutral): Siempre que se halle presente el Archivista Nacional o una persona invitada neutral, actuará como juez de arena y garante del cofre de custodia.\nConcordancias: Ley 001 de Convivencia y Reparación (TRD 100-01); Código de Convivencia · Libro IV (TRD 100-02); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bilateral bajo serie TRD 100-01.',
      sanction: 'Incumplimiento del acuerdo o retención de equipo ajeno: restitución completa + reparación de 15 {OE} + constancia inmediata de mora.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 010 · Seguridad Alimentaria, Canasta Básica y Mesa Compartida',
      text: 'EPÍGRAFE: Por la cual se declara la alimentación esencial como derecho vital en ambos territorios, se fijan precios justos y se instituye el Banquete de Cierre de Temporada.\nCONSIDERANDO:\n1. Que el Pacto de Oficios confía la agricultura a Nueva Alejandría y la ganadería y pesca a Luthadel, haciendo indispensable la cooperación alimentaria mutua.\n2. Que ninguna comunidad debe sufrir desabastecimiento injustificado ni especulación en sus víveres esenciales.\nDISPONE:\nArtículo 1. Deber de suministro y precio justo.\nNingún Estado negará la venta de alimentos esenciales al vecino ni aplicará precios superiores al doble (2×) del valor de referencia vigente en la Sesión de Tarifas.\nArtículo 2. Canasta básica protegida.\nComponen la canasta esencial: pan fresco, papa horneada, zanahoria, carnes cocidas de res, cerdo o ave y pescado cocido.\nArtículo 3. Intercambio y Banquete de Frontera.\nEn cada temporada ambas naciones realizarán compras recíprocas registradas en el Libro Mayor y celebrarán el Banquete de Cierre en la frontera común, compartiendo el pastel oficial elaborado con trigo y azúcar de Nueva Alejandría y leche y huevos de Luthadel.\nParágrafo Único (Desabastecimiento real): Cuando falten existencias comprobadas en bodega, el territorio proveedor dispondrá de 15 minutos o 1 jornada para reponer reservas antes de configurarse incumplimiento.\nConcordancias: Acuerdo 001 de Sesión de Tarifas (TRD 110-03); Decreto 001 de Caja Menor (TRD 110-01); Guía 001 de Bienvenida (TRD 110-05).\nVigencia: Rige desde su firma bilateral bajo serie TRD 100-01.',
      sanction: 'Negativa injustificada de suministro o cobro sobre el tope 2×: reparación de 15 {OE} + despacho al precio oficial vigente.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 011 · Ley Orgánica del Archivo Nacional, TRD y Memoria Plural',
      text: 'EPÍGRAFE: Por la cual se organiza el Archivo Nacional, se adopta la Tabla de Retención Documental (TRD), se impone el lenguaje claro en toda norma y se garantiza la pluralidad de la memoria histórica.\nCONSIDERANDO:\n1. Que inspirados en la tradición archivística de Miscolandia (Ley Orgánica 594 del Archivo), todo documento público debe clasificarse por series, redactarse en lenguaje comprensible para toda persona y conservarse conforme a su disposición final.\n2. Que la historia de Nueva Alejandría y Luthadel puede ofrecer miradas distintas sobre un mismo acontecimiento y ambas merecen preservación íntegra.\nDISPONE:\nArtículo 1. Objeto, lenguaje claro y custodia.\nEl Archivo Nacional resguarda las leyes, códigos, decretos, resoluciones, acuerdos, circulares, manuales, guías, sentencias, censos y crónicas de ambas naciones, procurando siempre claridad, trato incluyente y acceso público.\nArtículo 2. Actos de registro obligatorio.\nSe radicarán obligatoriamente: fundaciones urbanas, obras públicas, hallazgos o pérdidas de reliquias, tratados bilaterales, decisiones sancionatorias (TRD 100-02) y actas de cierre de temporada.\nArtículo 3. Principio de memoria histórica plural.\nCada nación conserva el derecho inviolable de redactar y conservar su propia crónica sobre cualquier acontecimiento; ningún relato suprime ni reemplaza al del territorio hermano.\nArtículo 4. Funciones del Archivista Nacional y Revisor.\nEl Archivista designado (o Revisor invitado) garantiza el consecutivo único, la serie TRD adecuada, el respaldo de las series de Conservación Total (CT) y la revisión previa de proyectos en el Buzón de Trámite.\nConcordancias: Resolución 001 de Foliado y TRD (TRD 110-02); Circular 001 de Revisión Jurídica (TRD 110-04); Manual 002 de Gestión Documental (TRD 110-05).\nVigencia: Rige desde su firma bilateral y deroga toda disposición contraria.',
      sanction: 'Alteración, ocultamiento o borrado deliberado de folios CT: reposición manuscrita en Libro Firmado + reparación de 20 {OE}.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 012 · Honra, Buen Nombre, Calumnia e Injuria',
      text: 'EPÍGRAFE: Por la cual se protege la honra y el buen nombre de toda persona en Nueva Alejandría y Luthadel, y se regulan la calumnia, la injuria y la difamación económica, sin sacrificar la sátira, el humor ni la memoria plural.\nCONSIDERANDO:\n1. Que en un mundo de dos Estados que comercian, se auditan y se juzgan entre sí, una acusación falsa puede causar multas injustas, mover el tipo de cambio o romper un tratado.\n2. Que el humor, la sátira y las versiones distintas de un mismo hecho son parte de la vida pública y no deben castigarse.\nDISPONE:\nArtículo 1. Bien protegido.\nSe protegen la honra y el buen nombre de los jugadores fundadores, de las personas visitantes e invitadas y de los Estados mismos.\nArtículo 2. Conductas.\na) Calumnia: atribuir a alguien, sabiendo que es falso, una conducta sancionable (robo, sabotaje, contrabando, trampa en Oferta Sellada, violación del Pacto de monopolios).\nb) Injuria: deshonrar a alguien con palabras o actos (letreros, libros firmados, nombres puestos con yunque a aldeanos o mascotas, estatuas o construcciones burlescas en territorio ajeno).\nc) Difamación económica: difundir datos falsos sobre la economía de un Estado (quiebra, mora, inflación, granjas inexistentes) para mover el tipo de cambio, el precio de sus acciones o sus ventas.\nArtículo 3. Dónde aplica.\nAplica al chat del servidor, letreros, libros, nombres, construcciones, crónicas de la app y a lo que un jugador le pida difundir al Pregonero.\nParágrafo 1 (El Pregonero): Los chismes del Pregonero son rumor de plaza y no tienen valor de prueba ni constituyen calumnia por sí mismos. Pero si un jugador le pide registrar o difundir algo falso (por ejemplo, con "pregonero recuerda que…"), responde ese jugador.\nArtículo 4. Lo que NO es calumnia ni injuria.\na) La verdad demostrada con pruebas (capturas, Libro Mayor, registros de la Aduana o del Archivo).\nb) La sátira o el humor evidente del rol, y las pullas propias de la convivencia.\nc) La crítica a la gestión de un Estado (precios, obras, leyes, economía).\nd) Las versiones distintas de un mismo hecho en el Archivo, según la Ley 011.\nArtículo 5. Procedimiento.\nLa persona afectada denuncia ante el Juez o con una crónica de tipo Disputa. Quien es señalado presenta sus descargos y sus pruebas en la misma sesión o en la siguiente. Si demuestra que lo dicho era verdad, se archiva el caso.\nArtículo 6. Rectificación.\nQuien resulte responsable rectifica en el mismo medio y con el mismo alcance: mensaje público en el chat, crónica de rectificación en el Archivo y retiro de letreros, libros, nombres o construcciones ofensivas en la siguiente sesión.\nArtículo 7. Reparación por difamación económica.\nSi la mentira movió el cambio o causó pérdidas registradas en el Libro Mayor, quien la difundió las repara.\nParágrafo 2 (Multas injustas): Si una calumnia causó una multa o una confiscación, esta se anula y lo pagado se devuelve.\nParágrafo 3 (Fuera del rol): Lo que pase fuera del rol entre los jugadores se habla directamente y no se multa por esta ley.\nConcordancias: Ley 001 (sanciones y debido proceso); Ley 011 (Archivo y memoria plural); Código de Convivencia y Justicia.',
      sanction: 'Injuria: rectificación + 10 {OE}. Calumnia: rectificación pública + 25 {OE} + anulación de cualquier multa injusta que haya causado. Difamación económica: 40 {OE} + reparación de las pérdidas registradas. Reincidencia: el doble y pérdida del derecho a publicar crónicas durante una temporada.'
    },
    {
      docType: 'ley',
      trdCode: '100-01',
      title: 'Ley 013 · Reserva de Estado y Construcciones Confidenciales',
      text: 'EPÍGRAFE: Por la cual se permite a cada Estado mantener bajo reserva construcciones, ubicaciones, diseños e información estratégica, con límites que impiden usar la reserva para ocultar infracciones.\nCONSIDERANDO:\n1. Que todo Estado tiene derecho a guardar en secreto sus bóvedas, sus diseños de ingeniería y sus planes, como parte de su soberanía y del juego entre ambos.\n2. Que la reserva no puede convertirse en un escondite para violar el Pacto de monopolios, emitir dinero sin respaldo o esconder reliquias nacionales.\nDISPONE:\nArtículo 1. Objeto de reserva.\nCada Estado puede declarar reservada una construcción, una zona, un diseño de redstone, unas coordenadas o un documento (por ejemplo: bóvedas, búnkeres, salas de reliquias, prototipos, rutas secretas o planes de obras).\nArtículo 2. Declaración.\nLa reserva se declara con una Resolución registrada en la app que indica solo un nombre genérico (ej. "Instalación Norte"), el Estado que la reserva, la fecha y el plazo. No se publican coordenadas ni contenido. En el mundo, el perímetro se marca con un letrero visible: "ZONA RESERVADA – [Estado]".\nArtículo 3. Plazo.\nLa reserva dura hasta dos temporadas y se puede prorrogar una vez con nueva Resolución. Al vencer, el lugar deja de ser reservado y su existencia se puede registrar en el Archivo.\nArtículo 4. Efectos.\nNinguna persona ajena al Estado puede, sin autorización expresa: entrar al perímetro, revelar sus coordenadas, compartir capturas o descripciones, ni copiar sus diseños. La autorización se da por escrito (libro firmado o mensaje en el chat) y puede ser parcial o temporal.\nArtículo 5. Límites de la reserva.\nNo puede declararse reservado:\na) Lo que viole el Pacto de monopolios (granjas o producción prohibida).\nb) Las obras públicas, la sede de La Gran Cámara del Ender ni la zona neutral.\nc) Las reliquias nacionales registradas según la Ley 005, cuya existencia debe constar aunque su ubicación sea reservada.\nArtículo 6. Auditoría reservada.\nUna obra reservada puede respaldar moneda solo si el otro Estado la audita en visita acompañada. Quien audita guarda el secreto de lo que vio y en la app la obra se registra con nombre genérico y sin coordenadas.\nArtículo 7. Levantamiento.\nLa reserva se levanta por vencimiento del plazo, por renuncia del Estado o por decisión del Juez cuando haya indicios serios de que oculta una infracción. En ese caso se hace una inspección acompañada y, si se confirma, se sanciona la infracción.\nParágrafo 1 (Lo técnico): La reserva es de rol. No impide el mantenimiento técnico del servidor ni los respaldos, pero lo que se vea por esa vía no se usa dentro del juego.\nParágrafo 2 (Espionaje): Obtener información reservada espiando, engañando o sobornando a un invitado también es violación de la reserva.\nConcordancias: Ley 005 (reliquias y patrimonio); Ley 006 (obras públicas); Ley 012 (honra y buen nombre); Pacto técnico de monopolios y granjas.',
      sanction: 'Entrar a una zona reservada sin autorización: salida inmediata + 15 {OE}. Revelar coordenadas, capturas o detalles: 30 {OE} + rectificación. Copiar un diseño reservado: desmantelar la copia + 40 {OE}. Usar la reserva para ocultar una infracción: se levanta la reserva y la sanción de esa infracción se duplica.'
    }
  ];

  /* -------------------- Tipos de acto administrativo, TRD y Pack Jurídico de Miscolandia -------------------- */
  const DOC_TYPES = {
    ley: { id: 'ley', label: 'Ley del Mundo (IC)', prefix: 'LEY', tag: 'amethyst', trd: '100-01' },
    codigo_penal: { id: 'codigo_penal', label: 'Código de Convivencia y Justicia (IC)', prefix: 'CCJ', tag: 'redstone', trd: '100-02' },
    decreto: { id: 'decreto', label: 'Decreto Ejecutivo (IC)', prefix: 'DEC', tag: 'gold', trd: '110-01' },
    resolucion: { id: 'resolucion', label: 'Resolución Administrativa (IC)', prefix: 'RES', tag: 'cyan', trd: '110-02' },
    acuerdo: { id: 'acuerdo', label: 'Acuerdo Bilateral (IC)', prefix: 'ACU', tag: 'emerald', trd: '110-03' },
    circular: { id: 'circular', label: 'Circular / Instructivo (IC)', prefix: 'CIR', tag: 'indigo', trd: '110-04' },
    manual: { id: 'manual', label: 'Manual / Guía Oficial (IC)', prefix: 'MNL', tag: 'copper', trd: '110-05' },
    servidor: { id: 'servidor', label: 'Regla del Servidor (OOC)', prefix: 'REG', tag: 'slate', trd: '160-01' }
  };

  const DEFAULT_TRD = [
    { code: '100-01', series: 'Actos Legislativos y Leyes (IC)', subseries: 'Leyes bilaterales y tratados del mundo', support: 'Registro Oficial + Libro Firmado Original', gestion: 'Mientras rija', central: 'Permanente', disp: 'CT', proc: 'Consecutivo único; si se sustituye o actualiza pasa a histórico sin eliminarse.' },
    { code: '100-02', series: 'Código de Convivencia y Sentencias (IC)', subseries: 'Libros normativos, medidas reparadoras y fallos ejecutoriados', support: 'Registro Oficial + Libro de Decisiones', gestion: 'Temporada en curso', central: 'Permanente', disp: 'CT', proc: 'Toda sentencia se radica con 7 datos esenciales y folio Disputa.' },
    { code: '100-03', series: 'Expedientes y Autos de Trámite (IC)', subseries: 'Requerimientos, descargos, apelaciones y traslados', support: 'Registro Oficial + Buzón de Trámite', gestion: 'Hasta ejecutoria', central: '2 temporadas', disp: 'S', proc: 'Anexar al expediente de la norma o proceso de convivencia.' },
    { code: '110-01', series: 'Decretos Ejecutivos (IC)', subseries: 'Decretos de gobierno, reserva y aduana', support: 'Registro Oficial + Sello Estatal', gestion: '1 temporada', central: '2 temporadas', disp: 'S', proc: 'Conservar decretos con impacto fiscal o territorial; resto a selección.' },
    { code: '110-02', series: 'Resoluciones Administrativas (IC)', subseries: 'Aranceles, aduanas, radicación y trámite', support: 'Registro Oficial + Tablón Oficial', gestion: 'Hasta nueva resolución', central: '1 temporada', disp: 'M', proc: 'Archivar vigente en tablón público y pasar copia auténtica al Archivo.' },
    { code: '110-03', series: 'Acuerdos Bilaterales y Actas (IC)', subseries: 'Actas de Sesión de Tarifas, límites y concejos', support: 'Registro Oficial + Libro de Actas', gestion: 'Temporada vigente', central: 'Permanente', disp: 'CT', proc: 'Suscripción conjunta de ambos Estados y testigo archivista.' },
    { code: '110-04', series: 'Circulares e Instructivos (IC)', subseries: 'Lineamientos técnicos de archivo, foliado y lenguaje claro', support: 'Registro Oficial + Tablón de Archivo', gestion: 'Mientras rija', central: '1 temporada', disp: 'M', proc: 'Divulgación obligatoria a ambos Estados, habitantes y visitantes.' },
    { code: '110-05', series: 'Manuales y Guías Oficiales (IC)', subseries: 'Manual ciudadano, manual archivístico y guía de bienvenida', support: 'Registro Oficial + Tablón Público y Museo', gestion: 'Mientras rija', central: 'Permanente', disp: 'CT', proc: 'Redactados en lenguaje claro e incluyente; actualización bilateral en cada reforma.' },
    { code: '120-01', series: 'Contratos y Obras Públicas (IC)', subseries: 'Obras registradas, verificaciones y patentes', support: 'Registro Oficial + Coordenadas', gestion: 'Hasta verificación y pago', central: 'Permanente', disp: 'CT', proc: 'Soporta la emisión de moneda y capitalización; prohibida su eliminación.' },
    { code: '130-01', series: 'Contabilidad y Tesoro (IC)', subseries: 'Libro Mayor, préstamos y Oferta Sellada', support: 'Libro Mayor Oficial', gestion: 'Temporada vigente', central: '2 temporadas', disp: 'CT', proc: 'Movimientos anulados se tachan (void); nunca se borra el asiento.' },
    { code: '140-01', series: 'Archivo Histórico y Crónicas (IC)', subseries: 'Crónicas, relatos y versiones de hechos', support: 'Registro Oficial + Bóveda del Archivo', gestion: 'Permanente', central: 'Permanente', disp: 'CT', proc: 'Cada Estado conserva su versión; ninguna versión borra a la otra.' },
    { code: '150-01', series: 'Censo, Cédulas (CC/CA) y Hospitalidad (IC)', subseries: 'Cédulas de aldeanos (CC), animales/mascotas (CA), cartas de residencia e invitados', support: 'Registro Oficial + Rótulo Nominal Físico', gestion: 'Mientras resida/viva', central: '1 temporada tras baja', disp: 'S', proc: 'Todo aldeano o animal protegido porta cédula CC/CA y rótulo físico; los decesos evitables dejan acta en el Archivo.' },
    { code: '160-01', series: 'Normativa Técnica del Servidor (OOC)', subseries: 'Reglas técnicas fuera de rol (OOC)', support: 'Panel OOC del Servidor', gestion: 'Permanente', central: '1 temporada', disp: 'E', proc: 'Acuerdos estrictamente OOC (fuera de rol); nunca se mezclan con documentos IC.' }
  ];

  const DEFAULT_PENAL_PACK = [
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Libro I · Protección del Patrimonio, Bóvedas y Bienes Comunes',
      text: 'EPÍGRAFE: Por el cual se describen de manera clara las conductas que afectan bienes privados, tesorerías públicas y estructuras en territorio delimitado.\nCONSIDERANDO:\n1. Que toda persona habitante o visitante debe distinguir con certeza cuándo un bien está disponible y cuándo se halla bajo reserva estatal o privada.\n2. Que el sistema sancionatorio distingue el aprovechamiento indebido intencional del simple descuido en zonas limítrofes.\nDISPONE:\nArtículo 1. Disposición indebida de bienes comunes.\nTomar recursos de cofres o cultivos señalizados de otro titular sin permiso previo.\nArtículo 2. Vulneración de bóvedas y tesorerías.\nAbrir o forzar accesos hacia bóvedas privadas, depósitos sellados o arcas públicas sin autorización escrita.\nArtículo 3. Aprovechamiento de estructuras sin aviso.\nExtraer tesoros de edificaciones antiguas dentro de jurisdicción demarcada sin notificar al Estado titular.\nArtículo 4. Custodia de bienes de origen irregular.\nRecibir, guardar o negociar artículos conociendo su obtención indebida.\nParágrafo 1 (Flagrancia): Cuando la persona sea sorprendida con los bienes en su poder, la reparación pecuniaria base aumenta un 50%.\nParágrafo 2 (Devolución voluntaria): Quien restituya el total antes de finalizar la jornada conmutará cualquier detención por reparación económica simple.\nParágrafo 3 (Confusión razonable): Si existe duda acreditada sobre límites o cofres comunes y se devuelve todo de inmediato, se archiva sin anotación (máximo 1 vez por temporada).\nConcordancias: Ley 001 de Convivencia y Reparación (TRD 100-01); Ley 005 de Patrimonio Nacional (TRD 100-01); Libro IV de Dosimetría (TRD 100-02); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bilateral bajo serie TRD 100-02.',
      sanction: 'Disposición simple: restitución + 10 {OE}. Vulneración de bóveda: restitución + 30 {OE} + hasta 10 min en recinto. Estructuras/custodia: restitución + 15 {OE}.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Libro II · Transparencia Fiscal, Moneda y Contratos Limpios',
      text: 'EPÍGRAFE: Por el cual se resguarda la fe pública monetaria, la veracidad de las auditorías de obra y la transparencia en contratos y Oferta Sellada.\nCONSIDERANDO:\n1. Que la confianza en {DR} y {CU} depende de la autenticidad de los billetes firmados originales y de respaldos reales.\n2. Que la Oferta Sellada y el crédito ante {BANK} exigen imparcialidad absoluta.\nDISPONE:\nArtículo 1. Adulteración o imitación monetaria.\nPoner en circulación papel renombrado o piezas no emitidas oficialmente simulando billetes auténticos.\nArtículo 2. Emisión sin registro ni respaldo.\nGenerar billetes físicos omitiendo su asiento simultáneo en el Libro Mayor o superando el techo respaldado.\nArtículo 3. Alteración interesada de avalúos.\nOfrecer o recibir ventajas para exagerar el puntaje de una obra o desviar su verificación técnica.\nArtículo 4. Quebranto del sigilo en Oferta Sellada.\nAveriguar o modificar la postura económica tras conocer la oferta cerrada de la contraparte.\nArtículo 5. Desvío de recursos públicos.\nDisponer de fondos de {BANK} o contratos estatales sin respaldo válido en el Libro Mayor (TRD 130-01).\nParágrafo 1 (Deber reforzado por cargo): Quien actúe como veedor o representante bancario asumirá incremento del 50% en la reparación pecuniaria.\nParágrafo 2 (Ajuste contable sin dolo): Diferencias hasta por 15 {OE} originadas en error aritmético podrán corregirse antes de la siguiente revisión mediante ajuste asentado en el Libro Mayor.\nConcordancias: Ley 006 de Obras Públicas (TRD 100-01); Ley 008 de Obligaciones y Crédito (TRD 100-01); Decreto 001 de Caja Menor (TRD 110-01); Acuerdo 001 (TRD 110-03).\nVigencia: Rige desde su firma bajo serie TRD 100-02.',
      sanction: 'Emisión irregular: retiro físico de piezas + reparación del 150% al 200%. Alteración/desvío: reintegro íntegro + 40 {OE} + suspensión temporal como veedor.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Libro III · Cuidado de Infraestructura, Habitantes y Creaciones',
      text: 'EPÍGRAFE: Por el cual se amparan las vías ferroviarias, los sistemas productivos, la población aldeana censada y los diseños técnicos inscritos.\nCONSIDERANDO:\n1. Que el lenguaje jurídico debe describir los hechos con precisión y respeto, evitando estigmas y dejando a salvo los incidentes fortuitos.\nDISPONE:\nArtículo 1. Daño o interferencia deliberada en infraestructura.\nAfectar o bloquear intencionalmente rieles, estaciones, mecanismos de redstone, bodegas o granjas estatales.\nArtículo 2. Traslado o retención indebida de habitantes.\nMover, encerrar en espacio indigno o apropiarse de ciudadanos aldeanos censados de otro territorio sin acuerdo expreso.\nArtículo 3. Descuido grave contra la vida de habitantes.\nProvocar el fallecimiento evitable de un ciudadano aldeano inscrito por omisión manifiesta de techo, cerramiento, iluminación o señalización de peligros.\nArtículo 4. Reproducción no autorizada de diseños.\nCopiar un circuito o arquitectura patentada sin cubrir la licencia vigente.\nParágrafo 1 (Conmutación por servicio comunitario): Cada 5 minutos de permanencia en recinto podrán conmutarse por 64 bloques de obra comunitaria si la parte afectada acepta.\nParágrafo 2 (Reincidencia): La reiteración dentro de la misma temporada habilita aumento hasta del 50% previo cotejo en el Archivo Nacional.\nConcordancias: Ley 002 de Ciudadanía Aldeana (TRD 100-01); Ley 007 de Cuidado de Infraestructura (TRD 100-01); Resolución 002 de Aranceles (TRD 110-02).\nVigencia: Rige desde su firma bajo serie TRD 100-02.',
      sanction: 'Daño deliberado: reparación integral + 25 {OE}. Descuido/retención aldeana: restitución y vivienda digna + 15 {OE}. Diseño sin licencia: retiro o pago doble.'
    },
    {
      docType: 'codigo_penal',
      trdCode: '100-02',
      title: 'Libro IV · Dosimetría Clara, Prescripción, Revisión e Indultos',
      text: 'EPÍGRAFE: Por el cual se unifican los rangos máximos de sanción, los plazos de prescripción, el derecho de revisión y la facultad bilateral de indulto.\nCONSIDERANDO:\n1. Que ninguna sanción es válida sin límites escritos previos ni sin derecho a revisión o reconocimiento de colaboración.\nDISPONE:\nArtículo 1. Rango para faltas leves.\nReparación entre 5 y 15 {OE} o hasta 64 bloques de obra comunitaria.\nArtículo 2. Rango para faltas graves.\nReparación entre 15 y 40 {OE}, reposición material y hasta 15 minutos efectivos en recinto habilitado.\nArtículo 3. Rango para faltas gravísimas.\nReparación entre 40 y 150 {OE}, hasta 20 minutos en recinto y/o restricción temporal urbana por máximo 2 jornadas.\nArtículo 4. Recurso de revisión y mediación.\nToda decisión puede revisarse dentro de la misma jornada ante la mesa bilateral con acompañamiento del Archivista Nacional.\nParágrafo 1 (Reconocimiento temprano): Quien reconozca su responsabilidad y repare voluntariamente antes de abrirse folio disciplinario obtiene rebaja del 40% en la suma pecuniaria.\nParágrafo 2 (Prescripción): Las faltas leves no radicadas antes del cierre de temporada prescriben de pleno derecho.\nParágrafo 3 (Indulto bilateral): Las y los gobernantes podrán conceder indulto motivado mediante Decreto o Acuerdo bilateral archivado en TRD 100-02.\nConcordancias: Ley 001 de Convivencia y Reparación (TRD 100-01); Circular 001 (TRD 110-04); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bajo serie TRD 100-02.',
      sanction: 'Exige acta completa de 7 campos en TRD 100-02; prohibida toda duplicación automática de penas.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 001 · Régimen de Viáticos, Representación y Caja Menor',
      text: 'EPÍGRAFE: Por medio del cual se reglamentan los gastos diplomáticos, viáticos de expedición y transparencia de caja menor estatal.\nCONSIDERANDO:\n1. Que las misiones oficiales, premios de ferias y banquetes de Estado requieren autorización presupuestal transparente y comprensible.\nDECRETA:\nArtículo 1. Tope de gastos autorizados.\nCada Estado podrá destinar hasta el 10% de su liquidez disponible en caja a viáticos de expedición, ceremonias o premios de ferias.\nArtículo 2. Soporte contable obligatorio.\nTodo desembolso deberá asentarse en el Libro Mayor Oficial con concepto expreso bajo serie TRD 130-01.\nArtículo 3. Prohibición de déficit oculto.\nNingún gasto de representación podrá generar saldo negativo ni sobrepasar el techo de emisión respaldado.\nParágrafo Único (Control recíproco): Cualquier Estado puede solicitar aclaración contable sobre gastos superiores a 20 unidades, quedando obligado a rendir igual informe cuando se le requiera.\nConcordancias: Ley 008 de Obligaciones y Crédito (TRD 100-01); Ley 010 de Seguridad Alimentaria (TRD 100-01); Código de Convivencia · Libro II (TRD 100-02).\nVigencia: Rige desde su firma y se archiva bajo serie TRD 110-01.',
      sanction: 'Gasto sin registro o que exceda respaldo: reversión contable y ajuste en Libro Mayor.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 002 · Control Aduanero, Custodia Preventiva y Remate',
      text: 'EPÍGRAFE: Por medio del cual se adopta el procedimiento claro de custodia aduanera, inventario y restitución de mercancías en aclaración.\nCONSIDERANDO:\n1. Que la ejecución de la Ley 004 de Fronteras y Aduanas exige un procedimiento reglado con derecho a descargos inmediatos.\nDECRETA:\nArtículo 1. Custodia preventiva en aduana.\nAnte mercancía comercial sin asiento en Libro Mayor o deuda en mora declarada, el Estado afectado podrá resguardar los bienes en depósito aduanero.\nArtículo 2. Acta de inventario y derecho a descargos.\nLa custodia exige acta inmediata con listado exacto de ítems y plazo de 1 jornada completa para presentar descargos o comprobante.\nArtículo 3. Disposición final de bienes.\nVencido el término sin descargo válido, los bienes pasan a remate transparente por Oferta Sellada para cubrir la deuda o reparación.\nParágrafo Único (Devolución sin demora): Si la persona demuestra pago legítimo o error administrativo, la mercancía se devuelve íntegra y sin recargo alguno.\nConcordancias: Ley 001 de Convivencia y Reparación (TRD 100-01); Ley 004 de Fronteras y Aduanas (TRD 100-01); Ley 008 de Obligaciones (TRD 100-01).\nVigencia: Rige desde su firma bajo serie TRD 110-01.',
      sanction: 'Custodia sin acta de inventario: devolución inmediata + reparación de 10 {OE}.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 001 · Estándares de Radicación, Foliado y TRD',
      text: 'EPÍGRAFE: Por la cual se fijan las reglas de radicación, foliado, lenguaje claro y clasificación en la Tabla de Retención Documental (TRD).\nCONSIDERANDO:\n1. Que la organización archivística garantiza memoria institucional, autenticidad probatoria y comprensión ciudadana de todos los actos públicos.\nRESUELVE:\nArtículo 1. Estructura mínima y lenguaje claro.\nTodo proyecto de Ley, Código, Decreto, Resolución, Acuerdo, Circular, Manual o Guía contendrá Epígrafe, Considerandos, Articulado, Concordancias y Vigencia, además de su serie TRD, evitando lenguaje excluyente u oscuro.\nArtículo 2. Consecutivo y folio físico.\nAl radicarse en el Registro Oficial, el documento recibe prefijo y consecutivo único, transcribiéndose copia auténtica en Libro Firmado para las series de Conservación Total (CT).\nArtículo 3. Intangibilidad de series CT.\nProhíbese eliminar documentos clasificados como CT; si pierden vigor se marcan como "Sustituida / Histórica" preservando íntegro su historial.\nParágrafo 1 (Responsabilidad archivística): El extravío injustificado de un libro firmado original CT obliga a su reposición manuscrita.\nParágrafo 2 (Revisión previa): Ningún acto IC podrá declararse definitivo sin revisión previa del Archivista Nacional cuando exista Revisor designado.\nConcordancias: Ley 011 del Archivo Nacional (TRD 100-01); Circular 001 de Revisión Jurídica (TRD 110-04); Manual 002 de Gestión Documental (TRD 110-05).\nVigencia: Rige desde su publicación bajo serie TRD 110-02.',
      sanction: 'Pérdida injustificada de folio CT: reposición manuscrita + 10 {OE}.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 002 · Tarifas Claras de Trámites, Residencia y Certificaciones',
      text: 'EPÍGRAFE: Por la cual se publican las tarifas administrativas transparentes por expedición de Cartas de Residencia, registros de invención y copias autenticadas.\nCONSIDERANDO:\n1. Que toda persona habitante o visitante debe conocer de antemano el costo exacto de sus trámites ante los Estados y el Archivo.\nRESUELVE:\nArtículo 1. Tarifas oficiales.\n(a) Carta de Residencia para persona visitante o invitada: 5 {OE}; (b) Registro oficial de diseño o patente técnica: 3 {OE}; (c) Copia autenticada de sentencia o crónica histórica: 2 {OE}.\nArtículo 2. Exención de consultas e inspecciones.\nLas consultas públicas en el Archivo Nacional y los certificados expedidos de oficio por el Archivista son gratuitos.\nParágrafo Único (Trámite prioritario): Las solicitudes marcadas de urgencia dentro de la misma jornada causan recargo del 50% a favor de la entidad expedidora.\nConcordancias: Ley 003 de Hospitalidad y Residencia (TRD 100-01); Ley 007 de Creaciones Propias (TRD 100-01); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bajo serie TRD 110-02.',
      sanction: 'Operar concesión o residencia sin pago del arancel vigente: requerimiento amigable de regularización + recargo del 100%.'
    },
    {
      docType: 'circular',
      trdCode: '110-04',
      title: 'Circular 001 · Lineamientos de Revisión Jurídica y Lenguaje Claro',
      text: 'EPÍGRAFE: Por medio de la cual el Archivo Nacional imparte pautas prácticas de redacción clara, devolución, subsanación y cita cruzada de normas.\nCONSIDERANDO:\n1. Que conforme al principio de lenguaje claro de Miscolandia, las normas deben ser entendidas fácilmente por cualquier persona sin sacrificar precisión jurídica.\nDISPONE:\nArtículo 1. Lista de chequeo archivística.\nAntes de otorgar aval, el Revisor verificará: (a) lenguaje claro e inclusivo sin términos estigmatizantes, (b) citas cruzadas (Concordancias) con normas relacionadas, (c) separación estricta de contenido IC respecto de acuerdos OOC, (d) topes máximos claros en medidas y plazos, y (e) serie TRD correcta.\nArtículo 2. Trámite de devolución.\nToda norma devuelta incluirá observaciones punto por punto en el Buzón de Trámite. Los Estados ajustarán el texto y la reenviarán a revisión.\nConcordancias: Ley 011 del Archivo Nacional (TRD 100-01); Resolución 001 de Foliado (TRD 110-02); Manual 002 (TRD 110-05).\nVigencia: Rige desde su publicación en el tablón de Normativa bajo serie TRD 110-04.',
      sanction: 'Norma devuelta no subsanada permanece en borrador hasta cumplir la lista de chequeo.'
    },
    {
      docType: 'acuerdo',
      trdCode: '110-03',
      title: 'Acuerdo 001 · Sesiones de Tarifas, Límites y Concilio Bilateral',
      text: 'EPÍGRAFE: Por el cual se reglamentan las Sesiones de Tarifas, las actas de delimitación territorial y los acuerdos de reforma económica entre Nueva Alejandría y Luthadel.\nCONSIDERANDO:\n1. Que los ajustes periódicos de precios, fronteras y parámetros del Banco neutral requieren acta formal vinculante y transparente.\nACUERDA:\nArtículo 1. Periodicidad de la Sesión de Tarifas.\nLas listas oficiales de precios se revisarán en Sesión de Tarifas (una vez por ciclo acordado o por temporada), dejando constancia en el Archivo bajo serie TRD 110-03.\nArtículo 2. Delimitación y expansión de fronteras.\nToda nueva reclamación territorial se notificará con coordenadas exactas de inicio y fin; sin oposición fundada en la siguiente jornada, queda inscrita en el Acuerdo territorial.\nArtículo 3. Reforma de parámetros de {BANK}.\nLos cambios a inercia del cambio, tasas de interés o topes de garantía requieren suscripción conjunta de ambas naciones.\nConcordancias: Ley 004 de Fronteras (TRD 100-01); Ley 006 de Obras Públicas (TRD 100-01); Ley 010 de Seguridad Alimentaria (TRD 100-01).\nVigencia: Rige desde su firma bajo serie TRD 110-03.',
      sanction: 'Modificación unilateral de tarifas fuera de sesión: reversión al precio anterior y devolución del excedente.'
    },
    {
      docType: 'circular',
      trdCode: '110-04',
      title: 'Circular 002 · Reglamento Técnico de Cédulas Nominales (CC y CA)',
      text: 'EPÍGRAFE: Por medio de la cual el Archivo Nacional y la Oficina del Censo establecen el formato único, numeración consecutiva y portación física de las Cédulas de Identidad para aldeanos (CC) y animales o mascotas (CA).\nCONSIDERANDO:\n1. Que al hallarse disponibles los rótulos nominales de fabricación artesanal común, todo ciudadano aldeano y todo animal o compañero valioso puede y debe contar con identificación individual desde el inicio de su morada.\n2. Que una identificación clara protege tanto al comercio gremial como a monturas, mascotas, guardianes y semovientes frente a confusiones o traslados.\nDISPONE:\nArtículo 1. Clases y prefijos oficiales de Cédula (TRD 150-01).\nToda inscripción en el Registro Civil recibirá código irrepetible con la sigla del territorio emisor (NA para Nueva Alejandría; LUT para Luthadel): (a) Serie CC para ciudadanos aldeanos (ej. CC-NA-0001) y (b) Serie CA para mascotas, monturas, golems o ejemplares pecuarios destacados (ej. CA-LUT-0001).\nArtículo 2. Contenido de la Cédula Física y Ficha Digital.\nEl rótulo nominal físico llevará obligatoriamente el nombre propio y el código oficial entre corchetes —por ejemplo "Mercurio [CC-NA-0001]" o "Ceniza [CA-LUT-0002]"— acompañado de su ficha en el Registro Civil con especie u oficio, tutor o Estado responsable, morada o establo y anotaciones clave.\nArtículo 3. Gratuidad, entrega física y conservación de folios.\nLa expedición de toda Cédula CC o CA es gratuita según la Ley 002. Una vez impuesta la cédula física, se marcará como portada en el Registro Civil. En caso de fallecimiento, el folio se conserva como archivo histórico con causa documentada y nunca se reutiliza el mismo código.\nConcordancias: Ley 002 de Ciudadanía y Cédulas (TRD 100-01); Resolución 001 de Foliado (TRD 110-02); Manual 001 (TRD 110-05); Manual 002 (TRD 110-05).\nVigencia: Rige desde su publicación bajo serie TRD 110-04 y aplica a la serie censal TRD 150-01.',
      sanction: 'Habitante aldeano o animal cedulado sin rótulo físico actualizado tras requerimiento: imposición del rótulo en yunque dentro de la misma jornada.'
    },
    {
      docType: 'manual',
      trdCode: '110-05',
      title: 'Manual 001 · Manual Ciudadano de Convivencia, Trámites y Justicia en Lenguaje Claro',
      text: 'EPÍGRAFE: Por el cual se pone a disposición de toda persona habitante o visitante una guía práctica y sencilla sobre derechos, economía, justicia y vida cotidiana en Nueva Alejandría y Luthadel.\nCONSIDERANDO:\n1. Que las leyes no deben quedarse en textos complejos sino traducirse en instrucciones claras que cualquiera pueda aplicar al instante.\nDISPONE:\nArtículo 1. Qué puedes hacer libremente en ambos territorios.\nTransitar por caminos reales, estaciones de ferrocarril y la sede de {BANK}; consultar cualquier norma en el Archivo Nacional; participar en ferias y banquetes; y ofrecer servicios como contratista si portas Carta de Residencia vigente (Ley 003).\nArtículo 2. Cómo celebrar contratos y pagos sin errores.\nTodo intercambio comercial entre Estados o préstamos se anota en el Libro Mayor (TRD 130-01) usando {OE} como unidad de referencia y pagando en {DR} (Dracmas) o {CU} (Clips Unales) mediante billetes firmados originales.\nArtículo 3. Qué hacer si ocurre un daño accidental o una disputa.\n1) Avisa de inmediato a la parte dueña del recinto o bien afectado; 2) Colabora en la reparación si fue accidente fortuito (Ley 007); 3) Si hay desacuerdo, solicita revisión amistosa con mediación del Archivista Nacional antes de acudir a medida sancionatoria (Ley 001 y Código de Convivencia · Libro IV).\nArtículo 4. Trámites rápidos y su tarifa.\nCarta de Residencia: 5 {OE} (Resolución 002); Registro de invención o circuito: 3 {OE}; Copia autenticada del Archivo: 2 {OE}; Consultas públicas: gratuitas.\nConcordancias: Ley 001 (TRD 100-01); Ley 003 (TRD 100-01); Ley 007 (TRD 100-01); Código de Convivencia · Libros I–IV (TRD 100-02); Resolución 002 (TRD 110-02); Guía 001 (TRD 110-05).\nVigencia: Rige desde su publicación como documento guía oficial bajo serie TRD 110-05.',
      sanction: 'Instrumento pedagógico y orientador; en caso de conflicto prevalece el texto específico de la Ley o Código concordante.'
    },
    {
      docType: 'manual',
      trdCode: '110-05',
      title: 'Manual 002 · Manual Técnico de Gestión Documental, TRD y Foliado del Archivo',
      text: 'EPÍGRAFE: Por el cual se unifican los procedimientos técnicos del Archivo Nacional para clasificar, foliar, revisar, conservar y citar todos los documentos públicos del mundo.\nCONSIDERANDO:\n1. Que la técnica archivística garantiza orden histórico, verificación rápida de antecedentes y transparencia frente a futuras temporadas.\nDISPONE:\nArtículo 1. Ciclo de vida documental (Radicación, Revisión y Firma).\nTodo documento público nace como borrador, pasa por control formal del Archivista Revisor conforme a la Circular 001, recibe firma bilateral y queda archivado bajo su serie TRD.\nArtículo 2. Regla de Conservación Total (CT) e intangibilidad.\nLas series 100-01, 100-02, 110-03, 110-05, 120-01, 130-01 y 140-01 son de Conservación Total: jamás se destruyen. Si una norma queda reemplazada se deja constancia de su texto anterior en el historial.\nArtículo 3. Obligación de Concordancias y Lenguaje Claro.\nTodo acto administrativo nuevo debe citar al pie qué normas desarrolla, complementa o actualiza mediante el bloque "Concordancias", y evitar tecnicismos excluyentes.\nArtículo 4. Estricta separación entre Universo (IC) y Técnico (OOC).\nEl Archivo Nacional resguarda exclusivamente actos dentro de la historia (IC). Las disposiciones técnicas de administración del mundo pertenecen a la serie separada 160-01 (OOC).\nConcordancias: Ley 011 del Archivo Nacional (TRD 100-01); Resolución 001 de Foliado (TRD 110-02); Circular 001 de Revisión Jurídica (TRD 110-04).\nVigencia: Rige desde su firma bilateral bajo serie TRD 110-05.',
      sanction: 'Proyecto que omita serie TRD, Concordancias o mezclare términos OOC será devuelto para subsanación antes de su firma.'
    },
    {
      docType: 'manual',
      trdCode: '110-05',
      title: 'Guía 001 · Guía Rápida de Bienvenida para Visitantes, Invitados y Nuevas Casas',
      text: 'EPÍGRAFE: Por la cual Nueva Alejandría y Luthadel brindan orientación amable en cinco pasos a toda persona que arriba por primera vez al mundo.\nCONSIDERANDO:\n1. Que llegar a una ciudad nueva debe ser una experiencia acogedora, clara y libre de confusiones sobre normas locales.\nDISPONE:\nArtículo 1. Paso 1 — Llegada y saludo diplomático.\nPreséntate en la plaza pública o sede del Archivo Nacional, solicita recorrido guiado por los caminos reales y ubica el Palacio de Justicia y {BANK}.\nArtículo 2. Paso 2 — Respeto a hogares, cultivos y aldeanos.\nNo tomes provisiones de cofres ajenos sin permiso y protege siempre la seguridad e iluminación de los habitantes aldeanos que visites (Ley 002).\nArtículo 3. Paso 3 — Solicita tu Carta de Residencia si deseas quedarte.\nElige tu territorio anfitrión (Nueva Alejandría o Luthadel), tramita tu Carta de Residencia conforme a la Ley 003 y la Resolución 002 (5 {OE}) y recibe las coordenadas de tu solar.\nArtículo 4. Paso 4 — Trabaja, comercia y aporta a la historia.\nPuedes aceptar obras pagadas en {DR} o {CU}, ofrecer botín de expedición, comprar acciones o proponer crónicas y revisiones en el Archivo.\nConcordancias: Ley 002 de Protección Aldeana (TRD 100-01); Ley 003 de Hospitalidad y Residencia (TRD 100-01); Ley 004 de Fronteras (TRD 100-01); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bilateral como guía de orientación ciudadana bajo serie TRD 110-05.',
      sanction: 'Documento orientador sin carácter sancionatorio; los límites aplicables están desarrollados en el Manual 001 y la Ley 003.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 003 · Reserva Estratégica, Tesoros y Suministros de Emergencia',
      text: 'EPÍGRAFE: Por medio del cual se organiza la reserva estratégica de alimentos, botiquines, herramientas y salvaguardia de bóvedas nacionales frente a calamidades o asedios.\nCONSIDERANDO:\n1. Que tanto Nueva Alejandría como Luthadel deben contar con existencias mínimas ante emergencias ambientales, asedios o desabastecimientos imprevistos.\nDECRETA:\nArtículo 1. Bóveda de Reserva Estratégica.\nCada nación mantendrá un depósito señalizado de víveres básicos, pociones curativas, madera y herramientas de auxilio en su capital y un fondo de respaldo en {BANK}.\nArtículo 2. Apertura extraordinaria de reservas.\nLas reservas solo se emplean ante asalto hostil severo, reconstrucción urgente de vivienda aldeana o emergencia alimentaria declarada (Ley 010).\nArtículo 3. Inventario transparente y reposición.\nTodo retiro de reserva estratégica se asienta en el Libro Mayor (TRD 130-01) y debe reponerse dentro de las dos jornadas siguientes.\nConcordancias: Ley 008 de Obligaciones (TRD 100-01); Ley 010 de Seguridad Alimentaria (TRD 100-01); Decreto 001 de Caja Menor (TRD 110-01).\nVigencia: Rige desde su firma bajo serie TRD 110-01.',
      sanction: 'Uso no justificado de reserva estratégica: reposición íntegra de insumos + ajuste en Libro Mayor.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 004 · Ordenamiento Urbano, Museos y Espacios Culturales',
      text: 'EPÍGRAFE: Por medio del cual se dictan normas de convivencia urbanística, iluminación segura, señalización de vías y protección de museos y monumentos.\nCONSIDERANDO:\n1. Que una ciudad ordenada, iluminada y claramente señalizada protege a su población aldeana y facilita el recorrido de visitantes.\nDECRETA:\nArtículo 1. Iluminación obligatoria de calles, plazas y moradas.\nTodo sector urbano con habitantes cedulados o tránsito habitual deberá contar con iluminación continua que impida aparición nocturna de amenazas hostiles (Ley 002).\nArtículo 2. Conservación de museos, archivo y monumentos.\nLas fachadas del Archivo Nacional, los Museos, el Palacio de Justicia y los monumentos históricos no pueden alterarse con estructuras improvisadas ni depósitos desordenados.\nArtículo 3. Señalización en lenguaje claro.\nCada barrio, estación, aduana y edificio cívico exhibirá cartel legible indicando nombre y si es de libre ingreso o acceso reservado.\nConcordancias: Ley 002 de Ciudadanía (TRD 100-01); Ley 005 de Patrimonio Histórico (TRD 100-01); Ley 006 de Obras Públicas (TRD 100-01); Guía 001 (TRD 110-05).\nVigencia: Rige desde su firma bajo serie TRD 110-01.',
      sanction: 'Obra improvisada sobre espacio cultural o falta reiterada de iluminación urbana: retiro o adecuación en 1 jornada.'
    },
    {
      docType: 'decreto',
      trdCode: '110-01',
      title: 'Decreto 005 · Gobernanza de Obras Mayores, Vías Férreas y Megaproyectos',
      text: 'EPÍGRAFE: Por medio del cual se reglamenta la planificación, mantenimiento preventivo y señalización segura de la red ferroviaria, puentes y megaproyectos conjuntos.\nCONSIDERANDO:\n1. Que la red ferroviaria troncal y las rutas seguras por el Nether unen diariamente a ambas naciones y requieren mantenimiento compartido.\nDECRETA:\nArtículo 1. Trazado seguro y mantenimiento de vías.\nTodo tramo de ferrocarril troncal o camino por el Nether contará con barandas o resguardo contra caídas, iluminación regular y desvíos señalizados en bifurcaciones.\nArtículo 2. Avance por etapas en megaproyectos.\nCada megaproyecto conjunto se divide en etapas verificables registradas bajo serie TRD 120-01 antes de reclamar su valoración.\nArtículo 3. Respuesta rápida ante avería vial.\nSi un tramo sufre desperfecto, cualquier Estado notificará en el tablón de Territorio y ambos colaborarán en su restablecimiento sin cobros unilaterales.\nConcordancias: Ley 004 de Fronteras y Servidumbres (TRD 100-01); Ley 006 de Obras Públicas (TRD 100-01); Acuerdo 001 (TRD 110-03).\nVigencia: Rige desde su firma bajo serie TRD 110-01.',
      sanction: 'Bloqueo no autorizado de vía troncal o incumplimiento de etapa comprometida: restitución inmediata de la vía y revisión del avalúo.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 003 · Protocolo de Ferias, Eventos Públicos y Certámenes',
      text: 'EPÍGRAFE: Por la cual se regulan la organización, puestos feriales, premios transparentes y seguridad durante ferias comerciales, banquetes y certámenes de honor.\nCONSIDERANDO:\n1. Que las ferias periódicas, banquetes fronterizos y torneos cívicos fortalecen el comercio y la hermandad entre pueblos.\nRESUELVE:\nArtículo 1. Convocatoria pública y libre concurrencia.\nToda feria o evento estatal será anunciado con fecha, lugar, reglas claras y lista de premios garantizados en caja menor o premios en especie.\nArtículo 2. Seguridad y neutralidad del recinto ferial.\nDurante la jornada del evento se garantiza paz pública en el recinto, custodia de pertenencias (Ley 009) y prohibición de acaparamiento en los puestos de venta.\nArtículo 3. Acta de cierre y memoria.\nAl finalizar la feria o el Banquete de Temporada, se levantará crónica breve en el Archivo (TRD 140-01) dejando constancia de los ganadores y acuerdos celebrados.\nConcordancias: Ley 009 de Duelos y Torneos (TRD 100-01); Ley 010 de Seguridad Alimentaria (TRD 100-01); Decreto 001 de Caja Menor (TRD 110-01).\nVigencia: Rige desde su firma bajo serie TRD 110-02.',
      sanction: 'Incumplimiento de premio ofrecido en certamen público: pago obligatorio desde caja estatal + reparación de 10 {OE}.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 004 · Registro y Certificación de Invenciones Técnicas y Patentes',
      text: 'EPÍGRAFE: Por la cual se adopta el trámite oficial para inscribir diseños de redstone, sistemas logísticos y arquitecturas complejas, y fijar su licencia de uso.\nCONSIDERANDO:\n1. Que proteger el ingenio constructor y de redstone requiere criterios objetivos para saber qué invenciones están registradas y cómo se licencian.\nRESUELVE:\nArtículo 1. Requisitos de inscripción.\nQuien solicite registro de invención indicará nombre del mecanismo, autoría, función técnica, coordenadas del prototipo funcional y valor de licencia sugerido (pago único de 3 {OE} según Resolución 002).\nArtículo 2. Verificación técnica y publicidad.\nEl socio o el Archivista constatará el funcionamiento del prototipo antes de expedir certificado en la serie TRD 120-01.\nArtículo 3. Licencias solidarias de emergencia.\nPara mecanismos indispensables de seguridad urbana o iluminación pública, no se negará licencia de uso al precio oficial de tarifa.\nConcordancias: Ley 007 de Creaciones Propias (TRD 100-01); Código de Convivencia · Libro III (TRD 100-02); Resolución 002 de Tarifas (TRD 110-02).\nVigencia: Rige desde su firma bajo serie TRD 110-02.',
      sanction: 'Copia no licenciada de invención certificada: pago doble de la licencia pactada o retiro del circuito.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 005 · Libro de Sentencias, Mediación y Paz y Salvos',
      text: 'EPÍGRAFE: Por la cual se adopta el formato estándar de siete campos para radicar decisiones sancionatorias, actas de mediación y certificados de cumplimiento (Paz y Salvo).\nCONSIDERANDO:\n1. Que toda persona que repara un daño o cumple una medida correctiva tiene derecho a que su expediente quede cerrado con constancia pública de Paz y Salvo.\nRESUELVE:\nArtículo 1. Formato único de decisión (TRD 100-02).\nToda sentencia firme deberá registrar en el Archivo: (1) persona obligada, (2) autoridad decisora, (3) conducta probada, (4) pruebas, (5) medida y cuantía exacta, (6) fechas y (7) estado actualizado.\nArtículo 2. Mediación previa simplificada.\nAntes de radicar sanción formal por falta leve, las partes podrán suscribir acta breve de mediación amistosa con restitución inmediata sin registro punitivo.\nArtículo 3. Expedición del Paz y Salvo.\nVerificada la entrega de la reparación, obra o término, el Archivista anotará estado "Cumplida" y expedirá Paz y Salvo gratuito que habilita de nuevo el pleno ejercicio comercial y crediticio.\nConcordancias: Ley 001 de Convivencia y Reparación (TRD 100-01); Código de Convivencia · Libro IV (TRD 100-02); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bajo serie TRD 110-02.',
      sanction: 'Negar injustificadamente constancia de Paz y Salvo tras cumplimiento verificado: intervención inmediata del Archivista Nacional.'
    },
    {
      docType: 'resolucion',
      trdCode: '110-02',
      title: 'Resolución 006 · Emisión Monetaria, Cotejo Contable y Cierre de Temporada',
      text: 'EPÍGRAFE: Por la cual se reglamentan los requisitos documentales para emitir nueva moneda respaldada, practicar arqueo de tesoro y suscribir el cierre contable de cada temporada.\nCONSIDERANDO:\n1. Que la solidez de {DR} y {CU} exige correspondencia exacta entre obras verificadas, billetes firmados originales y asientos del Libro Mayor.\nRESUELVE:\nArtículo 1. Límite de emisión y respaldo real.\nNinguna nación pondrá moneda en circulación por encima de su techo respaldado por emisión fundacional más obras públicas debidamente verificadas (TRD 120-01).\nArtículo 2. Anulación transparente de errores.\nEn el Libro Mayor nunca se suprime un asiento equivocado; se registra un asiento inverso de anulación (void) indicando el motivo claro.\nArtículo 3. Acta de cierre de temporada.\nAl concluir cada temporada se concilian cajas estatales, préstamos activos en {BANK} y reservas, archivando el balance final bajo series TRD 130-01 y 140-01.\nConcordancias: Ley 006 de Obras Públicas (TRD 100-01); Ley 008 de Obligaciones (TRD 100-01); Código de Convivencia · Libro II (TRD 100-02); Decreto 001 (TRD 110-01).\nVigencia: Rige desde su firma bajo serie TRD 110-02.',
      sanction: 'Exceso no respaldado o descuadre superior a 15 {OE}: suspensión automática de nueva emisión hasta corregir el balance.'
    },
    {
      docType: 'acuerdo',
      trdCode: '110-03',
      title: 'Acuerdo 002 · Pacto de Oficios Gremiales y Complementariedad Productiva',
      text: 'EPÍGRAFE: Por el cual Nueva Alejandría y Luthadel ratifican el reparto solidario de oficios y especialidades económicas para impulsar el comercio permanente.\nCONSIDERANDO:\n1. Que la especialización gremial evita competencias ruinosas y garantiza que ambos territorios se necesiten y enriquezcan mutuamente.\nACUERDA:\nArtículo 1. Especialidades y oficios de cada nación.\nNueva Alejandría lidera la agricultura, bibliotecaría, archivística, cartografía, destilación y granjas de experiencia; Luthadel lidera la minería y metalurgia, ganadería, pesca, armería, herrería y arquitectura ferroviaria.\nArtículo 2. Garantía de abasto a precio público.\nCada territorio garantiza disponibilidad razonable de los bienes de su monopolio gremial al precio oficial de su lista pública.\nArtículo 3. Excepciones por contrato o licencia.\nNinguna excepción gremial se presume: debe constar por escrito en licencia o contrato archivado bajo serie TRD 110-03.\nConcordancias: Ley 003 de Hospitalidad (TRD 100-01); Ley 010 de Seguridad Alimentaria (TRD 100-01); Acuerdo 001 (TRD 110-03).\nVigencia: Rige desde su firma bilateral bajo serie TRD 110-03.',
      sanction: 'Explotación no licenciada de gremio reservado: cese de actividad + reparación de 15 {OE} o pago de regalía pactada.'
    },
    {
      docType: 'acuerdo',
      trdCode: '110-03',
      title: 'Acuerdo 003 · Distrito Industrial Compartido y Zonas Neutrales Comunes',
      text: 'EPÍGRAFE: Por el cual se fija el régimen conjunto de administración, acceso, seguridad y reparto de beneficios en el Distrito Industrial Remoto y los nodos neutrales compartidos.\nCONSIDERANDO:\n1. Que ciertos complejos productivos de gran escala requieren ubicarse lejos de los cascos urbanos bajo administración y beneficios compartidos.\nACUERDA:\nArtículo 1. Neutralidad y copropiedad del Distrito Compartido.\nLas instalaciones conjuntas del Distrito Industrial Remoto, la sede central de {BANK} y los cruces troncales del Nether gozan de estatus neutral bilateral.\nArtículo 2. Uso ordenado y mantenimiento solidario.\nTodo aprovechamiento en zona compartida obliga a reponer combustible o insumos consumidos, dejar cofres ordenados y reparar cualquier avería ocasionada.\nArtículo 3. Distribución equitativa de rendimientos.\nSalvo convenio específico en contrario, las obras financiadas en partes iguales distribuyen sus productos o ingresos por mitad (50% y 50%) con asiento en Libro Mayor.\nConcordancias: Ley 004 de Fronteras y Servidumbres (TRD 100-01); Ley 006 de Obras Públicas (TRD 100-01); Decreto 005 (TRD 110-01).\nVigencia: Rige desde su firma bilateral bajo serie TRD 110-03.',
      sanction: 'Uso abusivo sin reposición de insumos o apropiación exclusiva de producción común: devolución del exceso + reparación de 20 {OE}.'
    },
    {
      docType: 'circular',
      trdCode: '110-04',
      title: 'Circular 003 · Instructivo de Crónicas Históricas, Museografía y Reliquias',
      text: 'EPÍGRAFE: Por medio de la cual el Archivo Nacional imparte instrucciones para redactar crónicas plurales, catalogar reliquias y montar placas históricas en los Museos.\nCONSIDERANDO:\n1. Que la memoria histórica de Nueva Alejandría y Luthadel se construye desde varias voces que merecen igual respeto archivístico.\nDISPONE:\nArtículo 1. Contenido mínimo de toda crónica (TRD 140-01).\nCada crónica consignará título claro, era histórica correspondiente, categoría (Fundación, Hazaña, Tratado, Disputa o Cultura), autoría o nación narradora y relato fiel de los hechos.\nArtículo 2. Respeto a versiones paralelas.\nUn acontecimiento relevante podrá contar con la crónica de Nueva Alejandría, la de Luthadel y la de invitados o del Archivista; ninguna reemplaza ni invalida a las demás.\nArtículo 3. Rotulado de museos y vitrinas (TRD 120-01).\nToda pieza o reliquia exhibida en museo portará referencia de su hallazgo, descubridor y código patrimonial.\nConcordancias: Ley 005 de Patrimonio Histórico (TRD 100-01); Ley 011 del Archivo Nacional (TRD 100-01); Manual 002 (TRD 110-05).\nVigencia: Rige desde su publicación bajo serie TRD 110-04.',
      sanction: 'Suplantar autoría o borrar crónica existente del socio: restitución íntegra del texto + anotación disciplinaria en TRD 100-02.'
    },
    {
      docType: 'circular',
      trdCode: '110-04',
      title: 'Circular 004 · Efecto de Sellado por Aval del Archivista y Actos Modificatorios',
      text: 'EPÍGRAFE: Por medio de la cual el Archivo Nacional precisa la diferencia jurídica entre la vigencia por firma bilateral y el sellado definitivo por Aval Archivístico.\nCONSIDERANDO:\n1. Que una norma aprobada bilateralmente por ambas naciones entra en vigencia inmediata entre ellas, pero solo adquiere sello de firmeza archivística cuando el Archivista Nacional emite su Aval.\n2. Que es necesario evitar alteraciones directas sobre normas ya avaladas y selladas.\nDISPONE:\nArtículo 1. Vigencia inmediata vs. Aval Archivístico.\nToda norma firmada por Nueva Alejandría y Luthadel rige de inmediato como norma vigente. Mientras no cuente con el Aval del Archivista Revisor, puede ajustarse mediante revisión directa; una vez otorgado el Aval, queda Sellada en firme.\nArtículo 2. Prohibición de edición directa sobre normas selladas.\nNinguna norma que ya haya recibido el Aval oficial del Archivista podrá editarse, borrarse ni derogarse de manera directa e informal.\nArtículo 3. Procedimiento mediante Acto Superior o Modificatorio.\nPara reformar, adicionar o sustituir una norma sellada por Aval, deberá radicarse un nuevo acto administrativo de jerarquía igual o superior (Ley, Decreto, Acuerdo o Resolución motivada) que señale expresamente qué artículos sustituye y conserve íntegro el folio histórico original.\nConcordancias: Ley 011 del Archivo Nacional (TRD 100-01); Resolución 001 de Foliado (TRD 110-02); Circular 001 (TRD 110-04); Manual 002 (TRD 110-05).\nVigencia: Rige desde su firma bajo serie TRD 110-04.',
      sanction: 'Alteración sin acto modificatorio de norma sellada por Aval: nulidad del cambio y restauración del folio original.'
    },
    {
      docType: 'manual',
      trdCode: '110-05',
      title: 'Guía 002 · Guía Práctica del Registro Civil y Cédulas Nominales (CC y CA)',
      text: 'EPÍGRAFE: Por la cual se explica en cuatro pasos claros cómo censar, nombrar y proteger a todo habitante aldeano (Serie CC) y a cada animal, mascota o montura (Serie CA).\nCONSIDERANDO:\n1. Que al poder confeccionarse rótulos nominales de forma artesanal sencilla, toda persona puede participar activamente en el Registro Civil sin trámites costosos.\nDISPONE:\nArtículo 1. Paso 1 — Distingue el tipo de Cédula.\nUsa Serie CC (ej. CC-NA-0001) para ciudadanos aldeanos con oficio o gremio; usa Serie CA (ej. CA-LUT-0001) para lobos, gatos, caballos, burros, mulas, camellos, allays, golems y semovientes valiosos.\nArtículo 2. Paso 2 — Registra la ficha gratuita.\nAbre el Registro Civil (TRD 150-01), elige tipo CC o CA, anota nombre propio, oficio o especie, jurisdicción, morada o establo y pulsa "Expedir Cédula": el sistema genera un código irrepetible sin costo alguno.\nArtículo 3. Paso 3 — Graba y coloca el rótulo físico.\nCopia con un clic el rótulo oficial (ej. "Mercurio [CC-NA-0001]"), aplícalo sobre la etiqueta en el yunque, colócalo al ciudadano o animal y marca "Puesta" en su fila.\nArtículo 4. Paso 4 — Cuidado, archivo de decesos y consulta.\nSi un habitante o animal cedulado fallece, su ficha nunca se destruye: pasa a estado de Archivo Histórico explicando lo ocurrido conforme a la Ley 002.\nConcordancias: Ley 002 de Ciudadanía y Cédulas (TRD 100-01); Circular 002 de Cédulas Nominales (TRD 110-04); Manual 001 (TRD 110-05).\nVigencia: Rige desde su firma bilateral como guía práctica oficial bajo serie TRD 110-05.',
      sanction: 'Guía práctica ciudadana vinculada al Registro Civil TRD 150-01; en caso de controversia rigen la Ley 002 y la Circular 002.'
    },
    {
      docType: 'manual',
      trdCode: '110-05',
      title: 'Manual 003 · Manual Oficial del Archivista Auditor y Auditoría de Obras (TRD 120-01)',
      text: 'EPÍGRAFE: Por el cual se designa oficialmente al Archivista Nacional como Auditor de Obras, Reliquias y Megaproyectos de Miscolandia, y se fijan la lista de chequeo, criterios técnicos por categoría y procedimiento de calificación bajo la serie TRD 120-01.\nCONSIDERANDO:\n1. Que el respaldo monetario de {DR} y {CU}, el crecimiento del techo de emisión y la activación de bloqueos automáticos por granjas exigen inspección imparcial, uniforme y verificable.\n2. Que el Archivista Nacional actúa como tercero neutral en Miscolandia para revisar normas y dar fe pública de las obras reales en el mundo.\nDISPONE:\nArtículo 1. Autoridad Auditora Oficial.\nEl Archivista Nacional (Revisor designado en la app) es el único Auditor Oficial encargado de inspeccionar, aprobar, ajustar puntaje, rechazar o reabrir toda obra radicada en "Economía → Obras & Auditoría" (TRD 120-01). Ningún otro Estado o jugador puede autoaprobar o avalar auditorías de obra en su reemplazo.\nArtículo 2. Lista de Chequeo Previa a la Aprobación.\nAntes de aprobar una obra, el Archivista Auditor verifica cinco requisitos obligatorios:\n(1) Categoría exacta y dueño correcto;\n(2) Nombre claro en el mundo y coordenadas X, Y, Z precisas (salvo obra bajo Reserva de Estado de la Ley 013, donde basta visita acompañada guardando secreto);\n(3) Campo Producto o Reliquia diligenciado cuando sea "Granja automática" (ej. hierro, slime, madera) o "Reliquia nacional";\n(4) Cumplimiento estricto de la Era actual y del Pacto de Oficios (no usar mecánicas de Eras futuras ni invadir monopolio ajeno sin licencia);\n(5) Obra realmente terminada y operativa en el mundo (no se aprueban cascarones vacíos, pilares sin techo ni mecanismos inactivos).\nArtículo 3. Criterios Técnicos y Puntaje Base por Categoría.\n- Edificio terminado (10 pts): estructura completa con paredes, techo, puerta, iluminación y función clara.\n- Edificio institucional o monumental (30 pts): sede cívica, templo, museo, banco, juzgado o monumento de gran escala y acabado.\n- Granja automática (25 pts base, rendimiento decreciente): mecanismo autónomo funcional sin lag severo. La 1.ª granja de un producto vale 100%, la 2.ª vale 50%, la 3.ª vale 25%... Si el producto está en el catálogo de bloqueos, al aprobarse bloquea su obtención manual para los demás.\n- Barrio gremial (20 pts): al menos 5 aldeanos reales con cédula o vivienda digna techada, cerrada e iluminada (Ley 002) y mesas de oficio permitidas.\n- Máquina redstone de servicio (15 pts) o Módulo de almacén automatizado (20 pts): sistema probado en funcionamiento real.\n- Tramo ferroviario (15 pts, ~500 bloques iluminados y con resguardo), Estación decorada (20 pts) e Infraestructura dimensional (25 pts, túneles/hubs seguros en Nether o End).\n- Etapa de megaproyecto (50 pts): fase completa y verificable conforme al Decreto 005.\n- Reliquia nacional (unique: Huevo de dragón 80, Elytra 40, Tridente 30, Maza 30, Faro 25, etc.): solo cuenta la primera de cada tipo por Estado y debe constar físicamente en Bóveda o Museo (Ley 005).\n- Otra (~10 pts base): tasada proporcionalmente por el Archivista según utilidad y esfuerzo.\nArtículo 4. Veredicto, Ajuste de Puntos, Rechazo y Reapertura.\nEl Archivista Auditor puede: (a) Aprobar manteniendo o ajustando los puntos finales según escala, arquitectura y utilidad; (b) Rechazar indicando por escrito en qué falló (incompleta, mecánica prohibida de Era futura, invasión de monopolio o lag); (c) Reabrir si la obra sufrió cambios o pérdida; y (d) Marcar Reliquia Perdida cuando desaparezca para descontar su respaldo.\nArtículo 5. Conservación Total e Imparcialidad.\nToda auditoría asentada en TRD 120-01 es de Conservación Total (CT): jamás se borra para ocultar historial. En inspecciones bajo Reserva de Estado (Ley 013), el Archivista audita presencialmente con el dueño, registra con nombre genérico sin coordenadas y guarda secreto estricto.\nConcordancias: Ley 005 (Reliquias); Ley 006 (Obras Públicas); Ley 011 (Archivo Nacional); Ley 013 (Reserva de Estado); Decreto 005 (Obras Mayores); Manual Económico MNL-ECO-01; Circular 004.\nVigencia: Rige desde su publicación como manual oficial de auditoría bajo serie TRD 110-05 y aplica a la serie catastral TRD 120-01.',
      sanction: 'Obra incompleta, duplicada sin utilidad o contraria a la Era/Pacto: rechazo inmediato sin respaldo monetario. Violación de secreto en auditoría reservada: sanciones de la Ley 013.'
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

  /* -------------------- Bloqueo automático por granjas --------------------
     Cuando el otro Estado AUDITA una obra de categoría "Granja automática" cuyo producto
     coincide con una de estas entradas, conseguir ese producto A MANO queda bloqueado para
     todos menos el dueño de la granja (salvo !permiso). Si la granja se pierde, se levanta.
     watch: [objetivo del marcador (máx. 16 letras), criterio de Minecraft, ítems MÍNIMOS que suelta cada evento
            (se usa el mínimo garantizado para no quitar nunca algo comprado)]
     items: lo que el bot confisca (solo lo obtenido, nunca lo comprado) y entrega al dueño. */
  const LOGS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak'];
  const FARM_LOCKS = [
    { id: 'madera', label: 'Madera', owner: 'myth', aliases: ['madera', 'arbol', 'arboles', 'tronco', 'troncos', 'tala', 'leña'],
      watch: LOGS.map((w, i) => [`fw_l_log${i}`, `minecraft.mined:minecraft.${w}_log`, 1]),
      items: LOGS.map(w => `minecraft:${w}_log`) },
    { id: 'bambu', label: 'Bambú', owner: 'myth', aliases: ['bambu', 'bamboo'],
      watch: [['fw_l_bamboo', 'minecraft.mined:minecraft.bamboo', 1]], items: ['minecraft:bamboo'] },
    { id: 'kelp', label: 'Kelp (algas)', owner: 'myth', aliases: ['kelp', 'alga', 'algas'],
      watch: [['fw_l_kelp', 'minecraft.mined:minecraft.kelp', 1], ['fw_l_kelpp', 'minecraft.mined:minecraft.kelp_plant', 1]], items: ['minecraft:kelp'] },
    { id: 'cactus', label: 'Cactus', owner: 'myth', aliases: ['cactus'],
      watch: [['fw_l_cactus', 'minecraft.mined:minecraft.cactus', 1]], items: ['minecraft:cactus'] },
    { id: 'slime', label: 'Slime', owner: 'myth', aliases: ['slime', 'babosa', 'babosas'],
      watch: [['fw_l_slime', 'minecraft.killed:minecraft.slime', 1]], items: ['minecraft:slime_ball'] },
    { id: 'polvora', label: 'Pólvora (creepers)', owner: 'myth', aliases: ['polvora', 'creeper', 'creepers'],
      watch: [['fw_l_creeper', 'minecraft.killed:minecraft.creeper', 1]], items: ['minecraft:gunpowder'] },
    { id: 'hierro', label: 'Hierro', owner: 'scad', aliases: ['hierro', 'iron', 'golem', 'golems'],
      watch: [['fw_l_golem', 'minecraft.killed:minecraft.iron_golem', 3], ['fw_l_fe', 'minecraft.mined:minecraft.iron_ore', 1], ['fw_l_fed', 'minecraft.mined:minecraft.deepslate_iron_ore', 1]],
      items: ['minecraft:iron_ingot', 'minecraft:raw_iron'] },
    { id: 'oro', label: 'Oro', owner: 'scad', aliases: ['oro', 'gold', 'piglin', 'piglins'],
      watch: [['fw_l_zpig', 'minecraft.killed:minecraft.zombified_piglin', 1], ['fw_l_au', 'minecraft.mined:minecraft.gold_ore', 1], ['fw_l_aud', 'minecraft.mined:minecraft.deepslate_gold_ore', 1], ['fw_l_aun', 'minecraft.mined:minecraft.nether_gold_ore', 2]],
      items: ['minecraft:gold_nugget', 'minecraft:gold_ingot', 'minecraft:raw_gold'] },
    { id: 'blaze', label: 'Varas de blaze', owner: 'scad', aliases: ['blaze', 'blazes'],
      watch: [['fw_l_blaze', 'minecraft.killed:minecraft.blaze', 1]], items: ['minecraft:blaze_rod'] },
    { id: 'brujas', label: 'Brujas (glowstone y azúcar)', owner: 'scad', aliases: ['bruja', 'brujas', 'witch', 'glowstone'],
      watch: [['fw_l_witch', 'minecraft.killed:minecraft.witch', 2]],
      items: ['minecraft:glowstone_dust', 'minecraft:sugar', 'minecraft:spider_eye', 'minecraft:redstone'] },
    { id: 'guardianes', label: 'Prismarina (guardianes)', owner: 'scad', aliases: ['guardian', 'guardianes', 'prismarina', 'prismarine'],
      watch: [['fw_l_guard', 'minecraft.killed:minecraft.guardian', 1]], items: ['minecraft:prismarine_shard', 'minecraft:prismarine_crystals'] }
  ];
  const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Qué entrada del catálogo corresponde a una obra (por lockId o por palabras del producto / nombre)
  function farmLockForWork(w) {
    if (!w || w.cat !== 'granja') return null;
    if (w.lockId) return FARM_LOCKS.find(l => l.id === w.lockId) || null;
    const words = normTxt(`${w.product || ''} ${w.name || ''}`).split(/[^a-z0-9]+/).filter(Boolean);
    return FARM_LOCKS.find(l => l.aliases.some(a => words.includes(normTxt(a)))) || null;
  }
  // Bloqueos vigentes: granjas auditadas (y no perdidas) del catálogo. Una por producto.
  function activeFarmLocks(state) {
    const out = [];
    const works = (state && state.economy && state.economy.works) || [];
    works.filter(w => w.status === 'auditada').forEach(w => {
      const lock = farmLockForWork(w);
      if (lock && !out.some(x => x.lock.id === lock.id)) out.push({ lock, work: w, owner: w.owner, since: w.auditedAt || w.createdAt || 0 });
    });
    return out;
  }
  function findFarmLock(word) {
    const n = normTxt(word);
    return FARM_LOCKS.find(l => l.id === n || l.aliases.some(a => normTxt(a) === n)) || null;
  }

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

  const ANIMAL_SPECIES = [
    { id: 'lobo', name: 'Lobo / Perro guardián' },
    { id: 'gato', name: 'Gato doméstico' },
    { id: 'caballo', name: 'Caballo / Corcel' },
    { id: 'burro', name: 'Burro / Mula de carga' },
    { id: 'camello', name: 'Camello / Dromedario' },
    { id: 'llama', name: 'Llama de caravana' },
    { id: 'happy_ghast', name: 'Happy Ghast (montura aérea)' },
    { id: 'nautilus', name: 'Nautilus / Compañero acuático' },
    { id: 'allay', name: 'Allay (asistente)' },
    { id: 'golem', name: 'Gólem de hierro / nieve' },
    { id: 'ajolote', name: 'Ajolote / Tortuga / Rana' },
    { id: 'lora', name: 'Lora / Ave / Abeja' },
    { id: 'ganado', name: 'Ejemplar pecuario (Vaca / Oveja / Cerdo / Mooshroom)' },
    { id: 'exotico', name: 'Otra especie (Sniffer / Armadillo / Strider / Zorro)' }
  ];

  /* -------------------- Manual Económico y Contable de Miscolandia (vive en Economía, ligado a TRD 120-01 y 130-01) -------------------- */
  const ECONOMY_MANUAL = {
    code: 'MNL-ECO-01',
    trd: 'TRD 120-01 · TRD 130-01 (Conservación Total · CT)',
    title: 'Manual Oficial de Economía, Tesoro y Archivística Contable de Miscolandia',
    epigraph: 'Por el cual se unifican en lenguaje claro las reglas de emisión monetaria, tipo de cambio, precios, crédito, acciones y registro archivístico de los bienes económicos de {NMYTH} y {NSCAD}.',
    considerando: [
      '1. Que la confianza económica entre naciones y visitantes exige que toda moneda emitida tenga respaldo real en obras construidas y verificadas.',
      '2. Que conforme a la archivística de Miscolandia, la contabilidad pública (TRD 130-01) y el catastro de obras (TRD 120-01) son series de Conservación Total (CT): jamás se borran asientos ni se oculta historia fiscal.'
    ],
    chapters: [
      {
        id: 'cap-1',
        num: 'Capítulo I',
        tone: 'emerald',
        trd: 'TRD 120-01',
        title: 'Emisión Monetaria, Respaldo Real e Inflación',
        summary: 'Cuánto dinero puede existir sin perder valor y cómo respaldar cada unidad emitida.',
        articles: [
          'Artículo 1. Techo de capitalización. Cada Estado inicia con su emisión fundacional y solo amplía su techo monetario mediante obras públicas, infraestructura, servicios o reliquias auditadas y aprobadas exclusivamente en "Obras & Auditoría" (TRD 120-01) por el Archivista Auditor Nacional.',
          'Artículo 2. Regla contra repetición estéril. Guardar cofres con ítems no crea respaldo. Repetir granjas del mismo producto aplica rendimiento decreciente (100%, 50%, 25%...), premiando infraestructura diversa y útil.',
          'Artículo 3. Emisión sana, superávit e inflación. Conservar superávit de respaldo (obras auditadas por encima del dinero emitido) valoriza y fortalece la moneda en {BANK} mientras no se imprima ese margen. Imprimir dentro del techo mantiene moneda sana. Imprimir por encima genera exceso sin respaldo: la moneda cae proporcionalmente en {BANK} y se bloquea el acceso a crédito hasta auditar nuevas obras o quemar billetes sobrantes.'
        ],
        concordancias: 'Serie TRD 120-01 (Obras y Contratos) · Código de Convivencia Libro II · Resolución 006.'
      },
      {
        id: 'cap-2',
        num: 'Capítulo II',
        tone: 'amethyst',
        trd: 'TRD 130-01',
        title: 'La Cámara Neutral y el Tipo de Cambio Flotante',
        summary: 'Cómo determina el mercado el valor entre {DR} y {CU}, y para qué sirve la unidad neutra {OE}.',
        articles: [
          'Artículo 4. Fondo neutral de reservas. {BANK} conserva reservas conjuntas en {DR} y {CU} mediante fórmula de producto constante con inercia configurable. Ningún gobernante fija la tasa a dedo: la mueven el comercio real, el superávit de respaldo auditado no emitido (que fortalece la divisa) y cualquier exceso sin respaldo (que la devalúa).',
          'Artículo 5. Equilibrio comercial automático. Si un territorio importa más de lo que vende, entrega su divisa a la Cámara y su valor baja suavemente, abaratando sus productos para estimular que el socio vuelva a comprarle.',
          'Artículo 6. Unidad de cuenta {OE}. Un {OE} equivale a media divisa de cada Estado (½ {DR} + ½ {CU}) al tipo de cambio del día. Es ideal para contratos largos, tasas y préstamos bilaterales para repartir riesgos cambiarios.'
        ],
        concordancias: 'Serie TRD 130-01 (Contabilidad y Tesoro) · Acuerdo 001 · Acuerdo 003.'
      },
      {
        id: 'cap-3',
        num: 'Capítulo III',
        tone: 'gold',
        trd: 'TRD 110-03',
        title: 'Tiendas Públicas, Regla del Minuto y Oferta Sellada',
        summary: 'Precios transparentes para habitantes y visitantes, y solución imparcial cuando no hay acuerdo.',
        articles: [
          'Artículo 7. Lista pública única y Regla del Minuto. Todo Estado publica sus precios en su propia moneda, iguales para el socio y para visitantes. Como punto de partida inicial, 1 unidad monetaria equivale aproximadamente a 1 minuto de juego ahorrado.',
          'Artículo 8. Sesión de Tarifas e impugnación. Los precios solo cambian en Sesión de Tarifas (TRD 110-03). Si una parte considera desproporcionado un valor, puede activar Oferta Sellada directamente desde el botón ⚖ de la tienda.',
          'Artículo 9. Mecanismo de Oferta Sellada. Vendedor (mínimo aceptable) y comprador (máximo ofrecido) ingresan cifras en secreto hasta por 2 intentos; si hay rango común, o al concluir el segundo intento, rige el punto medio exacto.'
        ],
        concordancias: 'Ley 010 (Canasta Básica) · Acuerdo 001 (Sesión de Tarifas) · Circular 001.'
      },
      {
        id: 'cap-4',
        num: 'Capítulo IV',
        tone: 'cyan',
        trd: 'TRD 130-01',
        title: 'Crédito, Inversión en Acciones y Rol de Visitantes',
        summary: 'Financiación estatal, límites prudenciales, acciones y dividendos.',
        articles: [
          'Artículo 10. Préstamos de {BANK} y entre pares. La Cámara presta solo a Estados sin mora previa ni inflación, respetando topes sobre capitalización y liquidez. Visitantes y socios pueden conceder préstamos directos pactando interés y vencimiento.',
          'Artículo 11. Acciones estatales. Cada Estado divide su capitalización en acciones cotizadas en su moneda. Quien trabaje o venda botín manual puede comprar acciones y ganar valor cuando el Estado audita obras o reparte dividendos.',
          'Artículo 12. Independencia económica de visitantes e invitados. Sus contratos, compras, préstamos y dividendos quedan respaldados en el Libro Mayor (TRD 130-01) sin requerir tener Estado propio.'
        ],
        concordancias: 'Ley 003 (Hospitalidad y Derechos Económicos) · Ley 008 (Crédito y Cobro).'
      },
      {
        id: 'cap-5',
        num: 'Capítulo V',
        tone: 'archival',
        trd: 'TRD 120-01 · 130-01',
        title: 'Archivística Contable (CT), No Borrado y Billetes Físicos',
        summary: 'Cómo se conectan el Libro Mayor, el Archivo Nacional de Miscolandia y los libros firmados.',
        articles: [
          'Artículo 13. Conservación Total e inalterabilidad del Libro Mayor. En la serie TRD 130-01 jamás se elimina un asiento para ocultar errores. Toda corrección se realiza mediante contra-asiento de anulación ("ANULADO / void") o asiento de ajuste motivado, conservando fecha, autoría y rastro íntegro.',
          'Artículo 14. Catálogo catastral y evidencia de obra. Toda obra auditable radicada en TRD 120-01 exige nombre claro en el mundo, categoría, coordenadas exactas y aprobación exclusiva del Archivista Auditor Nacional (Manual 003); si una reliquia nacional se extravía, se marca como perdida sin suprimir su folio.',
          'Artículo 15. Conciliación con billetes físicos (Libros Firmados Originales). En el juego, solo constituyen medio de pago válido los libros escritos y firmados marcados como "Original". Imprimir moneda en tesorería obliga a expedir los billetes equivalentes; quemar moneda obliga a destruir físicamente esos billetes para mantener paridad exacta con el Libro Mayor.'
        ],
        concordancias: 'Ley 011 (Archivo Nacional) · Resolución 001 (TRD) · Resolución 006 (Cierre Contable) · Manual 002.'
      }
    ],
    vigencia: 'Documento rector del módulo Económico (TRD 120-01 / TRD 130-01). No reemplaza las leyes de Estado; operacionaliza su registro contable y archivístico.'
  };

  return {
    DEFAULT_BANK_NAME, DEFAULT_BASKET, DEFAULT_NATIONS, MONOPOLIES, PACT_RULES, PROFESSIONS, ANIMAL_SPECIES, WORK_CATEGORIES,
    TRACKS, ERAS, SEASON_CHECKLIST, SEASON_POOLS, MEGAPROJECTS,
    WORLD_PROMPTS, NATION_PROMPTS, GUEST_QUESTS, DEFAULT_LAWS, DEFAULT_RP_LAWS,
    DOC_TYPES, DEFAULT_TRD, DEFAULT_PENAL_PACK, PRICE_GUIDE, RELICS, GLOSSARY, ECONOMY_MANUAL,
    FARM_LOCKS, farmLockForWork, activeFarmLocks, findFarmLock
  };
})();
