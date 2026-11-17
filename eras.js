/* ==========================================================================
   FOREVER WORLD — Eras y hitos
   Formato de cada hito: [id, quién, área, obligatorio(1/0), título, descripción, prueba]
   quién: 'myth' | 'scad' | 'ambos'
   área:  ing (técnico) · col (colección) · ter (territorio) · eco (economía)
          ins (instituciones) · rol (roleplay) · cul (cultura y lore) · haz (hazaña) · reto (reto cruzado)
   Regla de reparto: Mythstorm = agricultura, automatización, encantamientos, cultura,
   archivo y museo. Scadrial = ganadería, forja, alquimia, transporte, ferias y ceremonias.
   Los retos cruzados van en pares de dificultad parecida.
   ========================================================================== */

window.FW_ERAS_DATA = (() => {
  const TRACKS = {
    meta: { name: 'Preparación', tag: 'slate' },
    ing: { name: 'Técnico', tag: 'redstone' },
    col: { name: 'Colección', tag: 'lime' },
    ter: { name: 'Territorio', tag: 'copper' },
    eco: { name: 'Economía', tag: 'gold' },
    ins: { name: 'Instituciones', tag: 'cyan' },
    rol: { name: 'Roleplay', tag: 'pink' },
    cul: { name: 'Cultura', tag: 'amethyst' },
    haz: { name: 'Hazaña', tag: 'slate' },
    reto: { name: 'Reto cruzado', tag: 'indigo' }
  };

  const T = rows => rows.map(([id, who, track, req, title, desc, proof]) => ({ id, who, track, req: Boolean(req), title, desc, proof }));

  const ERAS = [
    /* ------------------------------------------------------------------ 0 */
    {
      id: 'era0', code: 'ERA 0', name: 'Antes del primer bloque', icon: 'compass',
      focus: 'Acordar lo que, si no se decide ahora, se pelea después.',
      allowed: ['Todo se hace fuera del juego o en un mundo de pruebas en creativo.'],
      banned: ['Empezar el mundo real sin backups automáticos.'],
      economy: 'Se fijan nombres de monedas, emisión fundacional y sensibilidad del cambio.',
      lore: [
        '¿Cómo se llama el mundo donde viven ambos Estados?',
        '¿{NMYTH} y {NSCAD} nacen como pueblos distintos o como uno que se separó?',
        '¿Qué tono quieren para la historia?',
        '¿Qué temas no quieren tocar en la historia?'
      ],
      tasks: T([
        ['e0-01', 'ambos', 'meta', 1, 'Versión, dificultad y reglas de juego', 'Elegir versión, dificultad y reglas (keepInventory, dormir, actualizaciones).', 'Regla del servidor 1 firmada.'],
        ['e0-02', 'ambos', 'meta', 1, 'Servidor y backups', 'Backups automáticos diarios y una restauración de prueba.', 'Un backup restaurado.'],
        ['e0-03', 'ambos', 'meta', 1, 'Firmar el Pacto de Monopolios', 'Revisar sectores y reparto de profesiones; ajustar lo injusto antes de jugar.', 'Regla "Pacto de monopolios" firmada.'],
        ['e0-04', 'ambos', 'eco', 1, 'Parámetros monetarios', 'Confirmar {DRN} y {CUN}, emisión fundacional e inercia del cambio.', 'Configuración revisada.'],
        ['e0-05', 'ambos', 'rol', 1, 'Firmar las leyes del mundo', 'Leer las leyes de roleplay sugeridas, cambiar lo que quieran y firmarlas.', 'Leyes del mundo vigentes.'],
        ['e0-06', 'ambos', 'meta', 0, 'Copia oficial del tablero', 'Decidir quién guarda la copia oficial y cada cuánto se sincroniza.', 'Primer archivo exportado.'],
        ['e0-07', 'ambos', 'meta', 0, 'Ritmo de juego', 'Cada cuánto hay Sesión de Tarifas y cuánto dura una Temporada.', 'Acordado en una regla.']
      ])
    },
    /* ------------------------------------------------------------------ I */
    {
      id: 'era1', code: 'ERA I', name: 'Asentamiento', icon: 'pickaxe',
      focus: 'Sobrevivir, elegir territorio y fundar los dos Estados.',
      allowed: ['Minado manual de todo, incluidos diamantes.', 'Mesa de encantamientos.', 'Cultivos a mano (solo {MYTH}) y animales a mano (solo {SCAD}).', 'Redstone sin cuarzo.'],
      banned: ['Comerciar con aldeanos o moverlos.', 'Encender el portal del Nether.', 'Cualquier granja automática.', 'Un cofre comunal.'],
      economy: 'Trueque. Al final: emisión fundacional en billetes y fundación de {BANK}.',
      lore: [
        '¿Por qué eligieron ese lugar para su capital?',
        '¿Qué separa a los dos territorios?',
        '¿Cuál fue el primer favor (o el primer roce) entre los dos pueblos?',
        '¿Qué significan las banderas?'
      ],
      tasks: T([
        ['e1-01', 'myth', 'ter', 1, 'Casa y bóveda de {NMYTH}', 'Casa terminada (techo, luz, interior) con bóveda privada rotulada.', 'Visita del otro.'],
        ['e1-02', 'scad', 'ter', 1, 'Casa y bóveda de {NSCAD}', 'Casa terminada (techo, luz, interior) con bóveda privada rotulada.', 'Visita del otro.'],
        ['e1-03', 'myth', 'col', 1, 'Huerta de los cuatro cultivos', 'Trigo, zanahoria, papa y remolacha en una huerta con riego y cerca.', 'Un stack de cada cosecha.'],
        ['e1-04', 'scad', 'col', 1, 'Corrales de las cuatro especies', 'Vacas, ovejas, cerdos y gallinas criados en corrales cerrados.', '4 especies con 4+ animales cada una.'],
        ['e1-05', 'myth', 'cul', 1, 'El primer libro del Archivo', 'Un atril con el primer libro firmado: el diario de los primeros días.', 'Libro en atril.'],
        ['e1-06', 'scad', 'ter', 1, 'Camino entre capitales', 'Camino pavimentado e iluminado entre las dos bases, con establo y 2 caballos domados.', 'Recorrido a caballo.'],
        ['e1-07', 'ambos', 'ins', 1, 'Frontera marcada', 'Acordar y marcar la frontera física (camino, postes, muro, faros).', 'Coordenadas en una ley o crónica.'],
        ['e1-08', 'ambos', 'rol', 1, 'Ceremonia de fundación', 'Cada uno funda su Estado con un acto: discurso en el chat, bandera izada y acta firmada en un atril.', 'Crónica de la ceremonia + dos actas en atriles.'],
        ['e1-09', 'scad', 'rol', 1, 'Primera feria de trueque', 'Organizar un puesto de mercado frente a frente y hacer 3 trueques con el otro.', '3 crónicas de tipo Comercio.'],
        ['e1-10', 'ambos', 'eco', 1, 'Bancos y primera emisión', 'Edificio de cada banco y emisión fundacional en libros firmados originales.', 'Billetes físicos = saldo de la app.'],
        ['e1-11', 'ambos', 'eco', 1, 'Fundar {BANK}', 'Edificio neutral en la frontera y aporte conjunto de reservas.', 'Reservas de la Cámara > 0.'],
        ['e1-12', 'ambos', 'haz', 1, 'Primera expedición de diamantes', 'Bajar juntos a la capa de diamantes y volver con 10 entre los dos.', '10 diamantes.'],
        ['e1-13', 'ambos', 'cul', 1, 'Banderas nacionales', 'Estandarte de cada Estado colgado en la capital y en la frontera.', 'Estandartes colgados.'],
        ['e1-14', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm forja', 'Fundir 24 lingotes y forjar una armadura de hierro completa.', 'Armadura puesta.'],
        ['e1-15', 'scad', 'reto', 1, 'Reto cruzado: Scadrial encanta', 'Montar una mesa de encantamientos y encantar 3 piezas de equipo.', '3 piezas encantadas.'],
        ['e1-16', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm abre una cantera', 'Abrir una cantera ordenada y fundir 2 stacks de piedra lisa.', '2 stacks de piedra lisa.'],
        ['e1-17', 'scad', 'reto', 1, 'Reto cruzado: Scadrial cablea', 'Puerta oculta con pistones y palanca, sin cuarzo.', 'Puerta funcionando.']
      ])
    },
    /* ------------------------------------------------------------------ II */
    {
      id: 'era2', code: 'ERA II', name: 'Raíces', icon: 'emerald',
      focus: 'Primeras granjas semiautomáticas y las primeras colecciones de plantas y animales.',
      allowed: ['Pistones, dispensadores, tolvas y relojes de redstone sin cuarzo.', 'Cría de todas las especies del Overworld cercano.'],
      banned: ['Observadores y comparadores (vienen con el Nether).', 'Aldeanos.', 'Nether.'],
      economy: 'Primera Sesión de Tarifas con la Regla del Minuto.',
      lore: [
        '¿Qué come cada pueblo? ¿Tienen un plato típico?',
        '¿Hay algún animal que sea símbolo de cada Estado?',
        '¿Cómo celebran la primera cosecha?'
      ],
      tasks: T([
        ['e2-01', 'myth', 'ing', 1, 'Granja de caña con pistones', 'Caña cosechada por pistones con un reloj o palanca, recogida con tolvas.', '1 stack de caña sin romper a mano.'],
        ['e2-02', 'scad', 'ing', 1, 'Granja de huevos y pollos', 'Gallinas encerradas, huevos a tolva y un sistema para criar y cocinar pollos.', '1 stack de pollo cocido.'],
        ['e2-03', 'myth', 'col', 1, 'Jardín de ocho plantas', 'Además de los 4 cultivos: sandía, calabaza, cacao y bayas dulces.', '8 plantas cultivadas.'],
        ['e2-04', 'scad', 'col', 1, 'Variantes de clima', 'Vacas, cerdos y gallinas de clima templado, cálido y frío (si su versión las tiene) o 3 razas de caballo distintas.', 'Las variantes en corrales.'],
        ['e2-05', 'myth', 'cul', 1, 'Sala de mapas', 'Cuarto con mapas en marcos que cubran el territorio conocido.', '4+ mapas en pared.'],
        ['e2-06', 'scad', 'ter', 1, 'Establo de cría selectiva', 'Criar caballos buscando velocidad y llevar un libro de linajes.', 'Caballo más rápido que el inicial.'],
        ['e2-07', 'ambos', 'eco', 1, 'Primera Sesión de Tarifas', 'Cada Estado publica 5+ productos en su tienda.', 'Tiendas con precios.'],
        ['e2-08', 'scad', 'rol', 1, 'Fiesta de la cosecha y el ganado', 'Evento: {NMYTH} lleva cosecha, {NSCAD} lleva animales, banquete en la frontera. El nombre de la fiesta lo eligen ustedes.', 'Crónica del evento.'],
        ['e2-09', 'myth', 'rol', 1, 'Escuela de oficios', 'Un edificio donde cada Estado exhibe y enseña su oficio (atriles con instrucciones de sus granjas).', 'Edificio con 2 atriles.'],
        ['e2-10', 'ambos', 'ins', 1, 'Registro de tierras', 'Mapa mural de zonas reclamadas y ley de cómo se reclama tierra nueva.', 'Mapa mural + ley.'],
        ['e2-11', 'ambos', 'haz', 1, 'Templo del desierto y de la jungla', 'Saquear los dos sin morir.', 'Botín registrado.'],
        ['e2-12', 'ambos', 'haz', 0, 'Puesto de avanzada saqueador', 'Limpiar un puesto de avanzada y liberar al gólem si lo hay.', 'Estandarte de illager.'],
        ['e2-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm hornea ladrillos', 'Batería de 4 hornos con tolvas que produzca 1 stack de ladrillos.', '1 stack de ladrillos.'],
        ['e2-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial cablea una trampa', 'Dispensador de flechas activado por placa de presión en la entrada de su base.', 'Trampa funcionando.'],
        ['e2-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm abre caminos', 'Tramo de camino de 200 bloques iluminado.', 'Recorrido.'],
        ['e2-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial escribe', 'Una crónica larga (una página completa) de la historia de su Estado hasta ahora.', 'Crónica en la app y en libro.']
      ])
    },
    /* ------------------------------------------------------------------ III */
    {
      id: 'era3', code: 'ERA III', name: 'Cobre y rieles', icon: 'rail',
      focus: 'El primer tren, el cobre y las Trial Chambers.',
      allowed: ['Rieles y rieles propulsados.', 'Cobre (las bombillas de cobre esperan al Nether: llevan vara de blaze).', 'Golems de cobre (si su versión los tiene).', 'Trial Chambers.'],
      banned: ['Nether todavía sellado.', 'Aldeanos.'],
      economy: 'Primeros contratos de obra y primera Oferta Sellada.',
      lore: [
        '¿Cómo se llama la primera línea de tren?',
        '¿Quién inauguró el tren y qué dijo?',
        '¿Qué piensa cada pueblo del otro ahora que están conectados?'
      ],
      tasks: T([
        ['e3-01', 'myth', 'ing', 1, 'Granja de calabaza y sandía', 'Cosecha con pistones activados por reloj, recogida con tolvas.', '1 stack de cada una.'],
        ['e3-02', 'scad', 'ing', 1, 'Granja de lana', 'Ovejas de colores con esquila automática (dispensador con tijeras) y recogida.', '1 stack de lana.'],
        ['e3-03', 'scad', 'ter', 1, 'Primera línea férrea', '500+ bloques entre capitales, 2 estaciones techadas e iluminadas.', 'Contador ≥ 500 + 2 estaciones.'],
        ['e3-04', 'myth', 'ing', 1, 'Despacho y retorno de vagonetas', 'Contrato con {NSCAD}: botón de salida y retorno automático en cada estación.', 'Ida y vuelta sin romper la vagoneta.'],
        ['e3-05', 'myth', 'col', 1, 'Herbario de diez flores', 'Diez flores distintas plantadas en un jardín con carteles.', 'Jardín con carteles.'],
        ['e3-06', 'scad', 'col', 1, 'Los dieciséis colores', 'Una oveja de cada uno de los 16 colores.', 'Corral arcoíris.'],
        ['e3-07', 'scad', 'rol', 1, 'Inauguración del tren', 'Ceremonia con cinta (lana) cortada, primer viaje oficial y boletos en papel renombrado.', 'Crónica + boleto guardado.'],
        ['e3-08', 'myth', 'cul', 1, 'Biblioteca fundacional', 'Edificio de biblioteca con 32+ librerías y una sala de lectura.', 'Biblioteca terminada.'],
        ['e3-09', 'ambos', 'eco', 1, 'Primer contrato de obra', 'Un Estado le paga al otro por un servicio (tramo, cableado, edificio).', 'Movimiento en el Libro Mayor.'],
        ['e3-10', 'ambos', 'eco', 1, 'Primera Oferta Sellada', 'Fijar un precio en desacuerdo con Oferta Sellada.', 'Resultado registrado.'],
        ['e3-11', 'ambos', 'haz', 1, 'Conquistar una Trial Chamber', 'Abrir sus cámaras y bóvedas. El botín se reparte por acuerdo.', 'Crónica con el reparto.'],
        ['e3-12', 'ambos', 'haz', 1, 'Mina abandonada', 'Explorar una mina abandonada y llevarse sus rieles para la red.', 'Rieles recuperados.'],
        ['e3-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm tiende vía', 'Tramo de 200 bloques de vía con una estación pequeña.', 'Tramo funcionando.'],
        ['e3-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial programa vagonetas', 'Su propio sistema de despacho y retorno de vagonetas en una estación.', 'Ida y vuelta automática.'],
        ['e3-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm fabrica rieles', 'Fundir hierro minado a mano y fabricar 64 rieles para la red.', '64 rieles entregados.'],
        ['e3-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial organiza', 'Una sala de mapas propia con 4 mapas del territorio de {NSCAD}.', 'Sala terminada.']
      ])
    },
    /* ------------------------------------------------------------------ IV */
    {
      id: 'era4', code: 'ERA IV', name: 'El Nether', icon: 'brewing',
      focus: 'La otra dimensión: cuarzo, alquimia, netherite y el primer hub.',
      allowed: ['Nether completo.', 'Observadores, comparadores y sensores de luz.', 'Destilerías.', 'Trueque con piglins a mano.'],
      banned: ['Granja de hierro.', 'Granjas de oro y de piglins.', 'Aldeanos.'],
      economy: 'Préstamos habilitados para financiar obras grandes.',
      lore: [
        '¿Qué es el Nether para cada pueblo?',
        '¿Quién controla el paso por el portal?',
        '¿Qué pasó el día que se encendió el primer portal?'
      ],
      tasks: T([
        ['e4-01', 'myth', 'ing', 1, 'Granja de caña y bambú con observadores', 'Totalmente automática, con almacenamiento. El bambú sirve de combustible.', 'Funciona sola.'],
        ['e4-02', 'scad', 'ing', 1, 'Destilería', 'Laboratorio con 4+ soportes. Las verrugas del Nether se le compran a {NMYTH}.', 'Debilidad y Resistencia al Fuego producidas.'],
        ['e4-03', 'scad', 'ter', 1, 'Nether Hub', 'Hub con túneles seguros a 3+ destinos (portales de cada capital, fortaleza, bastión).', '3 portales vinculados.'],
        ['e4-04', 'ambos', 'ins', 1, 'Edificio del portal', 'El primer portal dentro de un edificio de control.', 'Edificio terminado.'],
        ['e4-05', 'scad', 'ing', 1, 'Primera pieza de Netherite', 'Plantilla del bastión, debris y forja.', 'Pieza forjada.'],
        ['e4-06', 'myth', 'col', 1, 'Jardín del Nether y verrugas', 'Hongos carmesí y distorsionado con sus árboles, y una plantación de verrugas para vender a {NSCAD}.', 'Jardín + 1 stack de verrugas.'],
        ['e4-07', 'scad', 'col', 1, 'Montura de lava', 'Domar un strider con silla y caña con hongo distorsionado (hongo comprado a {NMYTH}), y cruzar un lago de lava.', 'Strider en un establo del hub.'],
        ['e4-08', 'myth', 'cul', 1, 'Cartografía del Nether', 'Mapa (o libro de coordenadas) de todas las rutas del hub.', 'Libro firmado en el hub.'],
        ['e4-09', 'scad', 'rol', 1, 'Pasaportes y control fronterizo', 'Diseñar el pasaporte (libro firmado) y hacer el primer control en el portal.', 'Pasaporte de cada jugador.'],
        ['e4-10', 'ambos', 'eco', 1, 'Primer préstamo', 'Financiar una obra (el hub, por ejemplo) con un préstamo.', 'Préstamo en la app.'],
        ['e4-11', 'ambos', 'haz', 1, 'Fortaleza del Nether', 'Saquearla y conseguir 10 varas de blaze.', '10 varas.'],
        ['e4-12', 'ambos', 'haz', 1, 'Bastión', 'Saquear un bastión entero.', 'Botín + plantilla.'],
        ['e4-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm cava el Nether', 'Túnel seguro de 200 bloques en el Nether, iluminado y con rieles o hielo.', 'Recorrido completo.'],
        ['e4-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial con observadores', 'Un circuito con observador y comparador (ej. indicador de cofre lleno).', 'Circuito funcionando.'],
        ['e4-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm destila', 'Producir 6 pociones distintas en un soporte propio.', '6 pociones.'],
        ['e4-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial encanta en serio', 'Sala de encantamiento con 15 librerías decorada y un encantamiento de nivel 30.', 'Sala + pieza nivel 30.']
      ])
    },
    /* ------------------------------------------------------------------ V */
    {
      id: 'era5', code: 'ERA V', name: 'Ciudadanía', icon: 'book',
      focus: 'Llegan los aldeanos: censo, biblioteca de encantamientos y siderúrgica.',
      allowed: ['Aldeanos en viviendas reales.', 'Solo las profesiones del propio Estado.', 'Granja de hierro (Gotham).', 'Una cura zombi por aldeano.'],
      banned: ['Salas de comercio 1×1.', 'Comerciar con aldeanos del otro.', 'Granjas de raids.'],
      economy: 'Esmeraldas = economía con NPCs. Tarifas de hierro y libros.',
      lore: [
        '¿Qué son los aldeanos para cada Estado: ciudadanos, inmigrantes, súbditos?',
        '¿Tienen derechos? ¿Cuáles?',
        '¿Hay alguna creencia o filosofía en cada Estado? (Pueden decidir que no.)'
      ],
      tasks: T([
        ['e5-01', 'myth', 'ing', 1, 'Granja de cultivos con aldeanos', 'Granjeros que cosechan y una tolva-vagoneta que recoge (zanahoria, papa o trigo).', '1 stack sin cosechar a mano.'],
        ['e5-02', 'scad', 'ing', 1, 'Siderúrgica (granja de hierro)', 'Granja de hierro dentro de un edificio industrial decorado.', '1 stack de hierro.'],
        ['e5-03', 'myth', 'cul', 1, 'Biblioteca de encantamientos', 'Bibliotecarios en viviendas reales con 4+ libros clave (Mending, Eficiencia, Irrompibilidad, Protección).', '4 bibliotecarios censados.'],
        ['e5-04', 'scad', 'ing', 1, 'Barrio de herreros', 'Armero, herrero de herramientas y de armas con sus talleres.', '3 herreros censados.'],
        ['e5-05', 'ambos', 'ins', 1, 'Censo', 'Todo aldeano con oficio tiene nombre y está en el Censo de la app.', '10+ aldeanos censados.'],
        ['e5-06', 'scad', 'ter', 1, 'Migración en tren', 'Traer 5 aldeanos de aldeas lejanas en vagoneta o barco.', '5 aldeanos trasladados.'],
        ['e5-07', 'myth', 'col', 1, 'Catálogo de libros', 'Reunir 10 libros encantados distintos (aldeanos o mesa).', '10 libros en la biblioteca.'],
        ['e5-08', 'scad', 'col', 1, 'Caballería', 'Llamas de los 4 colores y caballos de 5 colores distintos.', 'Establo con todos.'],
        ['e5-09', 'myth', 'rol', 1, 'Ceremonia de ciudadanía', 'Primer acto de ciudadanía: nombrar a los primeros aldeanos en público y entregarles su casa.', 'Crónica + aldeanos con nombre.'],
        ['e5-10', 'scad', 'rol', 1, 'Guardia nacional', 'Gólems de hierro como guardia, cuartel y un desfile en la capital.', 'Cuartel + 2 gólems con nombre.'],
        ['e5-11', 'ambos', 'eco', 1, 'Tarifas de hierro y libros', 'Precio del stack de hierro y del Mending fijado (Oferta Sellada si no hay acuerdo).', 'Precios vigentes.'],
        ['e5-12', 'ambos', 'haz', 1, 'Defender una aldea de una invasión', 'Sobrevivir a una raid real y ganar Héroe de la aldea.', 'Logro + tótem.'],
        ['e5-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm construye talleres', 'Tres talleres para el barrio de herreros de {NSCAD}.', '3 talleres.'],
        ['e5-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial construye la biblioteca', 'Tres casas de bibliotecario para {NMYTH}.', '3 casas.'],
        ['e5-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm transporta', 'Llevar 2 aldeanos en vagoneta por la red.', 'Aldeanos entregados.'],
        ['e5-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial cura', 'Curar un aldeano zombi.', 'Aldeano curado censado.']
      ])
    },
    /* ------------------------------------------------------------------ VI */
    {
      id: 'era6', code: 'ERA VI', name: 'Gremios y mercados', icon: 'emerald',
      focus: 'Economía madura: tiendas, ferias, colecciones grandes y la mansión del bosque.',
      allowed: ['Granjas de harina de hueso, madera y animales automáticas.', 'Tiendas automáticas con billetes.'],
      banned: ['Granjas de mobs hostiles (vienen en la Industria).'],
      economy: 'Patentes, contratos de suministro recurrentes y tiendas automáticas.',
      lore: [
        '¿Cómo se llama el gremio más importante de cada Estado?',
        '¿Hay rivalidad comercial? ¿Cómo se manifiesta?',
        '¿Qué producto es orgullo nacional de cada uno?'
      ],
      tasks: T([
        ['e6-01', 'myth', 'ing', 1, 'Granja de harina de hueso y flores', 'Compostador automático y dispensadores de harina de hueso para flores y tintes.', '1 stack de harina de hueso.'],
        ['e6-02', 'scad', 'ing', 1, 'Granja de cuero y carne', 'Vacas criadas y procesadas automáticamente.', '1 stack de cuero.'],
        ['e6-03', 'myth', 'ing', 1, 'Granja de madera', 'Árboles cultivados y cosechados de forma semiautomática o automática.', '4 stacks de troncos.'],
        ['e6-04', 'scad', 'ing', 1, 'Hornos en batería', '8+ hornos alimentados con tolvas para vidrio, piedra lisa y ladrillo.', '4 stacks procesados.'],
        ['e6-05', 'myth', 'col', 1, 'Arboreto', 'Un ejemplar de cada tipo de árbol (roble, abedul, abeto, jungla, acacia, roble oscuro, mangle, cerezo y pálido si existe).', 'Arboreto con carteles.'],
        ['e6-06', 'scad', 'col', 1, 'Medio Two by Two', 'Criar 12 especies de animales distintas.', 'Libro de registro.'],
        ['e6-07', 'myth', 'cul', 1, 'Museo de la Historia (sala 1)', 'Primera sala del museo con trofeos de las Eras I a V y placas.', 'Sala terminada.'],
        ['e6-08', 'scad', 'rol', 1, 'Gran Feria', 'Feria con puestos de ambos Estados, concurso (de construcción, de caballos o de pesca) y premio en dinero.', 'Crónica + premio pagado.'],
        ['e6-09', 'scad', 'rol', 1, 'Carreras de caballos', 'Hipódromo y primera carrera oficial con apuestas registradas.', 'Hipódromo + crónica.'],
        ['e6-10', 'ambos', 'eco', 1, 'Tienda automática', 'Cada Estado tiene una máquina que acepta billetes y entrega un producto.', '2 tiendas funcionando.'],
        ['e6-11', 'ambos', 'eco', 1, 'Contrato de suministro', 'Entrega periódica a precio fijo (ej. hierro por libros cada sesión).', 'Contrato + pagos registrados.'],
        ['e6-12', 'ambos', 'ins', 1, 'Registro de patentes', 'Registrar el primer diseño propio y cobrar su licencia.', 'Ley de patente + pago.'],
        ['e6-13', 'ambos', 'haz', 1, 'Mansión del bosque', 'Encontrarla, conquistarla y conseguir un tótem.', 'Tótem + crónica.'],
        ['e6-14', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm forja en serie', 'Tres armaduras de hierro completas para la guardia de {NSCAD}.', '3 armaduras.'],
        ['e6-15', 'scad', 'reto', 1, 'Reto cruzado: Scadrial encanta en serie', 'Aplicar libros en yunque a 3 piezas de equipo.', '3 piezas encantadas.'],
        ['e6-16', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm organiza un evento', 'Organizar una competencia deportiva (parkour, tiro con arco, laberinto).', 'Crónica del evento.'],
        ['e6-17', 'scad', 'reto', 1, 'Reto cruzado: Scadrial cura una exposición', 'Montar una vitrina del museo sobre {NSCAD} con placas.', 'Vitrina terminada.']
      ])
    },
    /* ------------------------------------------------------------------ VII */
    {
      id: 'era7', code: 'ERA VII', name: 'Industria', icon: 'anvil',
      focus: 'Autocrafting, logística de carga y granjas de mobs.',
      allowed: ['Crafters y líneas de ensamblaje.', 'Clasificadores y almacenes automáticos.', 'Granjas de brujas, slime, creepers y mobs.', 'Trenes de carga automáticos.'],
      banned: ['Granjas pesadas (lag) en las capitales.', 'Granjas de raids y de oro.'],
      economy: 'Patentes industriales y licencias.',
      lore: [
        '¿Cómo cambia la vida con la industria?',
        '¿Hay tensiones por recursos o fronteras?',
        '¿Qué piensa la gente de las fábricas?'
      ],
      tasks: T([
        ['e7-01', 'myth', 'ing', 1, 'Granja de cactus y kelp', 'Cactus automático y kelp con horno de kelp seco como combustible renovable.', '1 stack de bloques de kelp seco.'],
        ['e7-02', 'scad', 'ing', 1, 'Granja de brujas', 'Redstone, glowstone y azúcar a escala.', '1 stack de redstone.'],
        ['e7-03', 'myth', 'ing', 1, 'Almacén central automatizado', 'Clasificación automática de 16+ ítems con desborde.', '16 filtros.'],
        ['e7-04', 'myth', 'ing', 1, 'Fábrica de crafters', '3+ recetas automáticas bajo demanda.', '3 líneas funcionando.'],
        ['e7-05', 'scad', 'ter', 1, 'Línea de carga', 'Tren de carga automático entre la industria de {NSCAD} y el almacén de {NMYTH}.', 'Entrega sin intervención.'],
        ['e7-06', 'myth', 'ing', 1, 'Granja de slime y miel', 'Bloques de slime y de miel a escala para máquinas y elevadores.', '1 stack de bloques de cada uno.'],
        ['e7-07', 'scad', 'ing', 1, 'Granja de creepers y pólvora', 'Contrato con {NMYTH}: {NSCAD} la construye, {NMYTH} la opera y vende el TNT.', '1 stack de pólvora.'],
        ['e7-08', 'myth', 'col', 1, 'Los dieciséis tintes vegetales', 'Obtener de plantas todos los tintes posibles (flores, cactus, cacao, remolacha…).', 'Cofre con todos.'],
        ['e7-18', 'myth', 'col', 1, 'Colmenar', '3 colmenas con abejas; cosecha de miel y panal sin enojarlas.', 'Logro "Bee Our Guest".'],
        ['e7-09', 'scad', 'col', 1, 'Lobos del mundo', 'Domar 5 variantes de lobo distintas.', '5 lobos con nombre.'],
        ['e7-10', 'myth', 'cul', 1, 'Archivo Nacional', 'Edificio del Archivo con las crónicas en libros firmados.', 'Archivo con 10+ libros.'],
        ['e7-11', 'scad', 'rol', 1, 'Exposición industrial', 'Feria donde cada Estado muestra una máquina y el otro la vota.', 'Crónica + ganador.'],
        ['e7-12', 'ambos', 'ins', 1, 'Palacio de Justicia', 'Edificio con sala de audiencias y celda (Ley de Penas).', 'Primera sesión de juicio o simulacro.'],
        ['e7-13', 'ambos', 'haz', 1, 'El Wither', 'Derrotarlo y encender el primer faro.', 'Faro encendido.'],
        ['e7-14', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm lleva carga', 'Línea de carga de 300 bloques con descarga automática.', 'Descarga completa.'],
        ['e7-15', 'scad', 'reto', 1, 'Reto cruzado: Scadrial clasifica', 'Clasificador de 8 ítems con desborde.', 'Funciona.'],
        ['e7-16', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm funde', 'Batería de 8 hornos automática propia.', 'Funciona.'],
        ['e7-17', 'scad', 'reto', 1, 'Reto cruzado: Scadrial autocrafta', 'Un crafter que produzca una receta de forma automática.', 'Funciona.']
      ])
    },
    /* ------------------------------------------------------------------ VIII */
    {
      id: 'era8', code: 'ERA VIII', name: 'El Océano', icon: 'diamond',
      focus: 'Conquistar el mar: el templo de los guardianes, el tridente y el conducto.',
      allowed: ['Granja de guardianes (después de drenar el templo).', 'Granja de ahogados para tridentes.'],
      banned: ['Usar el templo antes de vaciarlo completo.'],
      economy: 'Prismarina y esponjas como mercancía.',
      lore: [
        '¿Quién construyó el templo del océano según cada pueblo?',
        '¿Qué significa el mar para {NMYTH} y para {NSCAD}?',
        '¿Hay puertos? ¿Cómo se llaman?'
      ],
      tasks: T([
        ['e8-01', 'ambos', 'haz', 1, 'Vaciar el templo de los guardianes', 'Matar a los 3 guardianes ancianos y DRENAR el templo completo (arena o esponjas).', 'Templo seco + 3 guardianes ancianos.'],
        ['e8-02', 'scad', 'ing', 1, 'Granja de guardianes', 'En el templo drenado: prismarina, pescado y XP.', '1 stack de fragmentos de prismarina.'],
        ['e8-03', 'myth', 'ing', 1, 'Granja de algas y pepinos de mar', 'Kelp y pepinos de mar automáticos para tintes y combustible.', '1 stack de cada uno.'],
        ['e8-04', 'ambos', 'haz', 1, 'El conducto', 'Construir y activar un conducto.', 'Conducto activo.'],
        ['e8-05', 'ambos', 'haz', 1, 'El tridente', 'Conseguir un tridente de ahogado.', 'Tridente registrado como reliquia.'],
        ['e8-06', 'myth', 'col', 1, 'Arrecife de coral', 'Los 5 corales vivos trasplantados a un arrecife propio.', 'Arrecife con carteles.'],
        ['e8-07', 'scad', 'col', 1, 'Acuario', 'Axolotes de 4 colores (5 si consiguen el azul), un pez tropical en cubo y un delfín cerca.', 'Acuario terminado.'],
        ['e8-08', 'scad', 'col', 1, 'Ranas y luces', 'Ranas de las 3 variantes y los 3 colores de luz de rana.', 'Logro de las luces de rana.'],
        ['e8-09', 'myth', 'cul', 1, 'Cartas náuticas', 'Conseguir 3 mapas del tesoro y encontrar sus tesoros.', '3 corazones del mar o tesoros.'],
        ['e8-10', 'scad', 'ter', 1, 'Puerto', 'Puerto con muelle, faro y barcos con cofre.', 'Puerto terminado.'],
        ['e8-11', 'scad', 'rol', 1, 'Regata', 'Carrera de barcos oficial con premio.', 'Crónica.'],
        ['e8-12', 'myth', 'rol', 1, 'Bautizo del puerto', 'Ceremonia de inauguración del puerto con nombre y placa.', 'Placa + crónica.'],
        ['e8-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm construye el muelle', 'Muelle con 3 amarres, barcos y faroles.', 'Muelle terminado.'],
        ['e8-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial ilumina el puerto', 'Luces automáticas nocturnas en todo el puerto con sensores de luz.', 'Luces funcionando.'],
        ['e8-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm levanta el faro', 'Faro del puerto (arquitectura) de 25+ bloques de alto.', 'Faro terminado.'],
        ['e8-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial busca tesoros', 'Encontrar un barco hundido y su tesoro sin ayuda.', 'Tesoro.']
      ])
    },
    /* ------------------------------------------------------------------ IX */
    {
      id: 'era9', code: 'ERA IX', name: 'Las Profundidades', icon: 'netherite',
      focus: 'La Ciudad Antigua, las Trial Chambers ominosas y la arqueología.',
      allowed: ['Deep Dark y Ciudades Antiguas.', 'Trial Chambers ominosas.', 'Arqueología y sniffers.'],
      banned: ['Entrar al End.'],
      economy: 'Subastas del botín de la Ciudad Antigua.',
      lore: [
        '¿Quién vivía en la Ciudad Antigua según cada pueblo?',
        '¿Qué cuentan las cerámicas que encontraron?',
        '¿Qué es el Warden en su historia?'
      ],
      tasks: T([
        ['e9-01', 'myth', 'ing', 1, 'Fábrica de pólvora industrial', 'Granja de creepers grande y TNT a escala.', '1 stack de TNT.'],
        ['e9-02', 'scad', 'ing', 1, 'Generador de piedra y basalto', 'Generadores automáticos de piedra/adoquín y basalto.', '4 stacks.'],
        ['e9-03', 'ambos', 'haz', 1, 'Ciudad Antigua', 'Saquear una Ciudad Antigua. Botín repartido por subasta sellada.', 'Crónica + reparto.'],
        ['e9-04', 'ambos', 'haz', 1, 'La maza', 'Trial Chamber ominosa: núcleo pesado y maza.', 'Maza registrada como reliquia.'],
        ['e9-05', 'myth', 'col', 1, 'Plantas antiguas', 'Cultivar la antorcha-flor y la planta jarra con semillas compradas a {NSCAD}.', 'Ambas plantas.'],
        ['e9-16', 'scad', 'col', 1, 'Sniffers', 'Eclosionar un huevo de sniffer, criar 2 y vender sus semillas a {NMYTH}.', '2 sniffers.'],
        ['e9-06', 'scad', 'col', 1, 'Armadura de lobo', 'Criar armadillos, conseguir escamas y forjar una armadura de lobo.', 'Lobo con armadura.'],
        ['e9-07', 'myth', 'cul', 1, 'Arqueología', 'Excavar ruinas, conseguir 6 cerámicas distintas y armar 2 vasijas decoradas.', 'Vasijas en el museo.'],
        ['e9-08', 'myth', 'cul', 1, 'Museo (sala 2): Lo antiguo', 'Sala con botín de la Ciudad Antigua, cerámicas y discos.', 'Sala terminada.'],
        ['e9-09', 'scad', 'ter', 1, 'Base subterránea', 'Estación o refugio en las profundidades conectado a la red.', 'Estación profunda.'],
        ['e9-10', 'scad', 'rol', 1, 'Expedición oficial', 'Antes de la Ciudad Antigua: equipamiento oficial, juramento de la expedición y diario de viaje.', 'Diario firmado.'],
        ['e9-11', 'ambos', 'eco', 1, 'Subasta del botín', 'Subastar un objeto de la expedición con oferta sellada.', 'Resultado en el Libro Mayor.'],
        ['e9-12', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm destila para la expedición', '4 pociones extendidas (+) distintas preparadas por él.', '4 pociones.'],
        ['e9-13', 'scad', 'reto', 1, 'Reto cruzado: Scadrial excava', 'Conseguir 4 cerámicas propias.', '4 cerámicas.'],
        ['e9-14', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm forja con estilo', 'Aplicar 2 diseños de armadura (trims) a su equipo.', 'Equipo con trims.'],
        ['e9-15', 'scad', 'reto', 1, 'Reto cruzado: Scadrial hace una bóveda', 'Puerta de bóveda con combinación de redstone.', 'Puerta funcionando.']
      ])
    },
    /* ------------------------------------------------------------------ X */
    {
      id: 'era10', code: 'ERA X', name: 'Soberanía', icon: 'beacon',
      focus: 'Estados maduros: faros completos, red nacional y el camino al End.',
      allowed: ['Granjas de blazes y de esqueletos.', 'Faros de todos los niveles.'],
      banned: ['Entrar al End antes de completar la era.'],
      economy: 'Mercado de acciones con invitados y revisión de la economía.',
      lore: [
        '¿Cómo se gobierna cada Estado hoy? ¿Cambió?',
        '¿Tienen calendario propio y fiestas?',
        '¿Qué sabe cada pueblo del End?'
      ],
      tasks: T([
        ['e10-01', 'myth', 'ing', 1, 'Granja de calabaza y sandía masiva', 'Granja grande con observadores y compactado en bloques.', '8 stacks.'],
        ['e10-02', 'scad', 'ing', 1, 'Granja de blazes', 'En un spawner de fortaleza: varas para la alquimia.', '1 stack de varas.'],
        ['e10-03', 'ambos', 'haz', 1, 'Faro de nivel máximo', 'Un faro con pirámide completa de 4 niveles (cada Estado aporta minerales).', 'Faro nivel 4.'],
        ['e10-04', 'scad', 'ter', 1, 'Red nacional', '5+ estaciones y 3.000+ bloques de vía con señalización.', 'Contador ≥ 3.000.'],
        ['e10-05', 'myth', 'ing', 1, 'Centro de control ferroviario', 'Selector de destino multi-estación (contrato con {NSCAD}).', 'Viaje a 3 destinos desde un panel.'],
        ['e10-06', 'scad', 'ter', 1, 'Tren al Stronghold', 'Localizar el Stronghold y llevar la red hasta él.', 'Estación en el Stronghold.'],
        ['e10-07', 'myth', 'col', 1, 'Biblioteca completa', 'Al menos un libro de cada encantamiento obtenible por aldeanos.', 'Catálogo completo.'],
        ['e10-08', 'scad', 'col', 1, 'Los nueve lobos', 'Todas las variantes de lobo domadas.', '9 lobos.'],
        ['e10-09', 'myth', 'cul', 1, 'Calendario nacional', 'Nombrar meses o épocas y fijar fiestas anuales de ambos Estados.', 'Calendario en Lore.'],
        ['e10-10', 'scad', 'rol', 1, 'Embajadas', 'Cada Estado construye una embajada en la capital del otro, con bandera y embajador (aldeano con nombre).', '2 embajadas.'],
        ['e10-11', 'myth', 'rol', 1, 'Tratado de amistad (o de rivalidad)', 'Escribir y firmar un tratado formal entre los Estados.', 'Tratado en la app y en atril.'],
        ['e10-12', 'ambos', 'eco', 1, 'Revisión económica', 'Revisar precios, inercia, techo y monopolios; cambiar por ley lo necesario.', 'Ley de reforma.'],
        ['e10-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm y los blazes', 'Una granja de blazes propia (o mejorar la de {NSCAD}).', 'Varas producidas.'],
        ['e10-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial cablea el centro', 'Un selector de 3 destinos propio.', 'Funciona.'],
        ['e10-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm construye la estación monumental', 'Estación terminal monumental para la red.', 'Estación terminada.'],
        ['e10-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial reúne libros', 'Reunir 15 libros encantados distintos por su cuenta.', '15 libros.']
      ])
    },
    /* ------------------------------------------------------------------ XI */
    {
      id: 'era11', code: 'ERA XI', name: 'El End', icon: 'ender_eye',
      focus: 'La última dimensión: dragón, Elytras y cajas de shulker.',
      allowed: ['End, Ciudades del End, Elytras y shulkers.'],
      banned: ['Granjas extremas cerca de las capitales.'],
      economy: 'Cajas de shulker como unidad de comercio a granel.',
      lore: [
        '¿Qué es el dragón en su historia?',
        '¿A quién pertenece el huevo? ¿Por qué?',
        '¿Qué pasa con el tren cuando existen las Elytras?'
      ],
      tasks: T([
        ['e11-01', 'ambos', 'haz', 1, 'Derrotar al dragón', 'Viajar en tren al Stronghold y vencer al dragón juntos.', 'Crónica del combate.'],
        ['e11-02', 'myth', 'ing', 1, 'Granja de shulkers', 'Granja de shulkers y estación de carga/descarga de cajas en el almacén.', 'Caja llenada y vaciada sola.'],
        ['e11-03', 'scad', 'ing', 1, 'Granja de endermen', 'XP y perlas a escala.', '1 stack de perlas.'],
        ['e11-04', 'myth', 'ing', 1, 'Granja de chorus', 'Fruta de chorus cosechada y procesada.', '1 stack de fruta de chorus.'],
        ['e11-05', 'ambos', 'haz', 1, 'Ciudades del End', 'Una Elytra por jugador.', '2 Elytras.'],
        ['e11-06', 'myth', 'col', 1, 'Cabeza del dragón', 'Conseguir la cabeza del dragón en un barco del End.', 'Cabeza en el museo.'],
        ['e11-07', 'scad', 'col', 1, 'Gatos del mundo', 'Domar las 11 variantes de gato.', '11 gatos.'],
        ['e11-08', 'myth', 'cul', 1, 'Museo (sala 3): El End', 'Huevo de dragón (si es suyo), Elytra, cabeza y la historia del combate.', 'Sala terminada.'],
        ['e11-09', 'scad', 'rol', 1, 'Desfile de la victoria', 'Desfile en ambas capitales celebrando al dragón.', 'Crónica.'],
        ['e11-10', 'ambos', 'ins', 1, 'Ley del espacio aéreo', 'Decidir dónde se puede volar y cómo se protege la red de tren.', 'Ley vigente.'],
        ['e11-11', 'ambos', 'eco', 1, 'Subasta del huevo', 'Si los dos lo quieren: el huevo se subasta con oferta sellada.', 'Resultado o acuerdo registrado.'],
        ['e11-12', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm abre autopista', 'Autopista de hielo azul de 500 bloques en el Nether.', 'Recorrido en barco.'],
        ['e11-13', 'scad', 'reto', 1, 'Reto cruzado: Scadrial vuela', 'Máquina voladora de slime/miel que recorra 100 bloques.', 'Vuelo completo.'],
        ['e11-14', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm forja Netherite', 'Una herramienta de Netherite forjada por él mismo con sus materiales.', 'Herramienta.'],
        ['e11-15', 'scad', 'reto', 1, 'Reto cruzado: Scadrial cartografía', 'Mapa mural de 3×3 mapas de {NSCAD}.', 'Mapa mural.']
      ])
    },
    /* ------------------------------------------------------------------ XII */
    {
      id: 'era12', code: 'ERA XII', name: 'Edad de Oro', icon: 'gold',
      focus: 'Granjas extremas, distrito industrial remoto y las primeras megaobras.',
      allowed: ['Granjas de oro, raids, esqueletos wither y similares SOLO en el distrito remoto (sugerido >2.000 bloques).'],
      banned: ['Granjas pesadas cerca de las capitales.'],
      economy: 'Corporaciones: los Estados pueden vender acciones de proyectos concretos.',
      lore: [
        '¿Cómo se ve cada capital ahora?',
        '¿Qué cambió en la relación entre los dos pueblos?',
        '¿Cuál es el mayor orgullo de cada Estado?'
      ],
      tasks: T([
        ['e12-01', 'scad', 'ter', 1, 'Distrito industrial remoto', 'Túnel o línea rápida a un distrito lejano para granjas pesadas.', 'Ruta + estación.'],
        ['e12-02', 'scad', 'ing', 1, 'Granja de oro', 'En el distrito remoto. El oro es materia prima, no moneda.', '1 stack de oro.'],
        ['e12-03', 'myth', 'ing', 1, 'Granja de raids', 'Esmeraldas, tótems y ballestas en el distrito remoto.', '5 tótems.'],
        ['e12-04', 'scad', 'ing', 1, 'Granja de esqueletos wither', 'Cráneos para invocar Withers a voluntad.', '6 cráneos.'],
        ['e12-05', 'myth', 'ing', 1, 'Granja agrícola total', 'Un complejo que produzca automáticamente 8+ cultivos distintos.', '8 cultivos automáticos.'],
        ['e12-06', 'myth', 'col', 1, 'A Balanced Diet', 'Comer todos los alimentos del juego.', 'Logro.'],
        ['e12-07', 'scad', 'col', 1, 'Two by Two', 'Criar todas las especies de animales criables.', 'Logro.'],
        ['e12-08', 'myth', 'cul', 1, 'Museo (sala 4): Las artes', 'Pinturas, estandartes de diseño propio, discos y armaduras con trims.', 'Sala terminada.'],
        ['e12-09', 'ambos', 'cul', 1, 'Primera megaobra', 'Iniciar una megaobra (catedral, palacio, puente de 1.000 bloques…).', 'Primera etapa terminada.'],
        ['e12-10', 'scad', 'rol', 1, 'Juegos nacionales', 'Olimpiada con 3 pruebas (carrera, tiro, laberinto) y medallas.', 'Crónica + premios.'],
        ['e12-11', 'myth', 'rol', 1, 'Coronación o investidura', 'Ceremonia formal del jefe de cada Estado según su forma de gobierno.', 'Crónica.'],
        ['e12-12', 'ambos', 'eco', 1, 'Primer inversor externo', 'Un invitado (o el otro Estado) compra acciones y recibe un dividendo.', 'Movimientos en el Libro Mayor.'],
        ['e12-13', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm tiende la línea rápida', '1.000 bloques de vía o hielo hacia un destino nuevo.', 'Recorrido.'],
        ['e12-14', 'scad', 'reto', 1, 'Reto cruzado: Scadrial automatiza', 'Una fábrica de crafters propia con 2 recetas.', 'Funciona.'],
        ['e12-15', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm esculpe', 'Una estatua o monumento ecuestre de 20+ bloques de alto.', 'Monumento.'],
        ['e12-16', 'scad', 'reto', 1, 'Reto cruzado: Scadrial computa', 'Un contador o pantalla de 7 segmentos de redstone.', 'Funciona.']
      ])
    },
    /* ------------------------------------------------------------------ XIII */
    {
      id: 'era13', code: 'ERA XIII', name: 'Leyenda', icon: 'enchanted_book',
      focus: 'Completar el mundo: todas las colecciones y los retos más duros. Después de esto, la Era ∞.',
      allowed: ['Todo.'],
      banned: ['Nada nuevo: las leyes que ustedes tengan siguen vigentes.'],
      economy: 'La economía es madura; se gobierna por sus leyes y Sesiones de Tarifas.',
      lore: [
        '¿Cómo recordarán estas eras los habitantes del futuro?',
        '¿Qué leyenda se cuenta de cada fundador?',
        '¿Qué queda por descubrir?'
      ],
      tasks: T([
        ['e13-01', 'ambos', 'haz', 1, 'Matar al Warden', 'Vencer al Warden (no huir de él).', 'Crónica + botín.'],
        ['e13-02', 'ambos', 'haz', 1, 'Adventuring Time', 'Visitar todos los biomas del logro.', 'Logro.'],
        ['e13-03', 'ambos', 'haz', 1, 'Monsters Hunted', 'Matar a todos los monstruos del logro.', 'Logro.'],
        ['e13-04', 'myth', 'ing', 1, 'Jardín botánico total', 'Todos los cultivos y plantas del juego creciendo, la mayoría automáticos.', 'Jardín con carteles.'],
        ['e13-05', 'scad', 'ing', 1, 'Zoológico total', 'Todas las especies y sus variantes (pandas, loros, zorros, conejos, cabras, mooshrooms…).', 'Zoológico con carteles.'],
        ['e13-06', 'myth', 'col', 1, 'Todos los discos', 'Todos los discos de música en una sala con tocadiscos.', 'Sala de discos.'],
        ['e13-07', 'scad', 'col', 1, 'Todos los diseños de armadura', 'Todas las plantillas de trim reunidas y exhibidas.', 'Armería con todas.'],
        ['e13-08', 'myth', 'cul', 1, 'El Gran Museo', 'El museo completo, con una sala por era.', 'Recorrido guiado grabado o en crónica.'],
        ['e13-09', 'myth', 'cul', 1, 'La Historia completa', 'Un libro (o varios) que resuma toda la historia de ambos Estados.', 'Libros en el Archivo.'],
        ['e13-10', 'scad', 'rol', 1, 'Gran Exposición Universal', 'Evento final con pabellones de cada Estado y de los invitados.', 'Crónica.'],
        ['e13-11', 'ambos', 'cul', 1, 'Megaobra terminada', 'Terminar la megaobra iniciada en la Edad de Oro.', 'Inauguración.'],
        ['e13-12', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm destila todo', 'Una poción de cada tipo del juego preparada por él.', 'Estante con todas.'],
        ['e13-13', 'scad', 'reto', 1, 'Reto cruzado: Scadrial reúne discos', 'Conseguir por su cuenta 10 discos distintos.', '10 discos.'],
        ['e13-14', 'myth', 'reto', 1, 'Reto cruzado: Mythstorm forja todo', 'Armadura completa de Netherite forjada por él mismo.', 'Armadura.'],
        ['e13-15', 'scad', 'reto', 1, 'Reto cruzado: Scadrial escribe la crónica', 'Escribir la crónica de su Estado de todas las eras.', 'Libro en el Archivo.']
      ])
    }
  ];

  return { TRACKS, ERAS };
})();
