# Forever World

Roadmap, economía, leyes, lore y territorio para servidor Survival de Minecraft, listo para **GitHub Pages** con base de datos y sincronización en vivo en **Supabase**.

## 1. Configurar la base de datos en Supabase

1. Crea un proyecto gratuito en [Supabase](https://supabase.com/).
2. Abre **SQL Editor** en tu proyecto y ejecuta completo el archivo [`supabase.sql`](./supabase.sql).
   Esto crea:
   - `public.fw_worlds`: estado compartido del mundo con control optimista de versiones (`rev`).
   - `public.fw_snapshots`: puntos de restauración en la nube.
   - Función RPC `public.fw_save_world` y publicación de **Realtime** para actualizar en vivo entre jugadores.
3. Ve a **Project Settings → API** (o **Data API / API Keys**) y copia:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Anon / Publishable Key**
4. Puedes conectarlo de dos formas:
   - **Para todos automáticamente (recomendado):** pega la `url` y `anonKey` en [`supabase-config.js`](./supabase-config.js) y haz `git push`.
   - **Desde la página:** abre **Guardar / Cargar → Configurar Supabase**, pega los datos y usa **Copiar enlace** para enviárselo a tus amigos.

## 2. Publicar en GitHub Pages

1. En el repositorio `https://github.com/Jhonny0523/foreverworld`, entra a **Settings → Pages**.
2. En **Build and deployment → Source**, elige **Deploy from a branch**.
3. Selecciona la rama **`main`** y la carpeta **`/ (root)`**, y pulsa **Save**.
4. Tu sitio quedará publicado en `https://jhonny0523.github.io/foreverworld/`.
