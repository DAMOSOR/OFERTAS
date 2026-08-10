# Ofertas Iluminación — App de presupuestos (PWA)

App web instalable en móvil y PC que reproduce el funcionamiento de tu Excel de ofertas:
buscas un código de la tarifa, se rellena solo (descripción, PVP, RAEE, descuento) y calcula
el neto y el subtotal. Al guardar, queda registrada y puedes recuperarla/editarla luego.
Botón para generar el presupuesto en PDF.

Funciona **offline** (una vez cargada) y, si configuras Firebase (gratis), las ofertas se
**sincronizan entre el móvil y el PC** automáticamente.

---

## 1. Subir el proyecto a GitHub y publicarlo (GitHub Pages)

1. Entra en https://github.com y crea un repositorio nuevo, por ejemplo `ofertas-app`
   (puede ser público o privado, ambos funcionan con GitHub Pages).
2. Sube **todos los archivos de esta carpeta** tal cual (mantén la estructura de carpetas
   `css/`, `js/`, `data/`, `icons/`). Puedes hacerlo:
   - arrastrando los archivos desde la web de GitHub ("Add file → Upload files"), o
   - con git desde tu ordenador:
     ```
     git init
     git add .
     git commit -m "Primera versión de la app de ofertas"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/ofertas-app.git
     git push -u origin main
     ```
3. En el repositorio, ve a **Settings → Pages**.
4. En "Source" elige la rama `main` y la carpeta `/ (root)`. Guarda.
5. Espera 1-2 minutos. GitHub te dará una URL del tipo:
   `https://TU_USUARIO.github.io/ofertas-app/`
6. Abre esa URL en el móvil: en Chrome/Safari aparecerá la opción **"Añadir a pantalla de
   inicio"** (o "Instalar app"). Así te queda como una app normal, con icono propio.
   En el PC, Chrome/Edge muestran un icono de instalación en la barra de direcciones.

A partir de aquí ya tienes la app funcionando en modo **local** (cada dispositivo guarda sus
propias ofertas). El siguiente paso es activar la sincronización.

---

## 2. Activar la sincronización entre móvil y PC (Firebase, gratis)

Usamos **Firestore** (base de datos de Google Firebase). El plan gratuito (Spark) es más
que suficiente para este uso: miles de ofertas al mes sin coste.

1. Ve a https://console.firebase.google.com y entra con una cuenta de Google.
2. **Crear proyecto** → ponle un nombre, por ejemplo `ofertas-empresa` → puedes desactivar
   Google Analytics (no hace falta) → Crear proyecto.
3. En el menú lateral, entra en **Bases de datos y almacenamiento → Firestore** (el menú de
   Google cambia de vez en cuando; si no ves "Compilación", búscalo directamente ahí) →
   **Crear base de datos** → si te pide edición, elige **Standard** → deja el ID como
   `(default)` → elige una ubicación cercana (ej. `eur3 (Europa)`) → en las reglas de
   seguridad elige **modo de prueba** para crearla rápido (luego fijamos las reglas
   definitivas en el siguiente paso).
4. Dentro de Firestore, ve a la pestaña **Reglas** y sustituye el contenido por esto (permite
   leer y escribir solo con la app; para más seguridad, luego puedes añadir autenticación):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ofertas/{ofertaId} {
         allow read, write: if true;
       }
     }
   }
   ```
   Publica los cambios.
5. Vuelve a la página principal del proyecto (icono de engranaje → **Configuración del
   proyecto**). Baja hasta "Tus apps" → pulsa el icono **`</>`** (Web) → dale un nombre
   (ej. "ofertas-web") → **Registrar app**.
6. Te mostrará un bloque `firebaseConfig` así:
   ```json
   {
     "apiKey": "AIza...",
     "authDomain": "ofertas-empresa.firebaseapp.com",
     "projectId": "ofertas-empresa",
     "storageBucket": "ofertas-empresa.appspot.com",
     "messagingSenderId": "123456789",
     "appId": "1:123456789:web:abcdef"
   }
   ```
   Copia ese objeto completo (desde la primera `{` hasta la última `}`).
7. Abre tu app → pestaña **Ajustes** → pega ese JSON en "Configuración Firebase" → **Guardar
   y conectar**. El indicador de arriba a la derecha debe ponerse en verde ("Sincronizado").
8. Repite el paso 7 en el otro dispositivo (móvil o PC) pegando la **misma** configuración.
   A partir de ahí, todas las ofertas guardadas aparecerán en ambos.

> Nota de seguridad: la regla del punto 4 deja la base de datos abierta a cualquiera que
> tenga la URL del proyecto. Es habitual para uso interno/pequeño, pero si quieres cerrarlo
> más adelante puedo ayudarte a añadir un usuario y contraseña (Firebase Authentication).

---

## 3. Datos de tu empresa y logo para el PDF

En la pestaña **Ajustes → Datos para el PDF del presupuesto**, rellena nombre, CIF,
dirección, teléfono, email, IVA y validez de la oferta. Se guardan en el dispositivo y se
usan cada vez que generas un PDF.

El PDF incluye por defecto el **logo de Disano Iluminación** con sus colores corporativos
(dorado `#DB9600` y grafito `#211915`). Si alguna vez necesitas hacer una oferta con otro
logo, puedes subir uno distinto en "Logotipo (para el PDF)"; el botón "Usar logo de Disano"
te devuelve al logo por defecto en cualquier momento.

---

## 4. Actualizar la tarifa de precios en el futuro

El catálogo (`data/products.json`) se generó a partir de tu pestaña **2023S**. Cuando tengas
una tarifa nueva:

1. Guarda la nueva tarifa como `.xlsx` con las mismas columnas (B=Código, C=Descripción,
   D=Ficha técnica, E=PVP, F=RAEE, M=% descuento).
2. Ejecuta:
   ```
   pip install openpyxl
   python tools/export_catalog.py "NuevaTarifa.xlsx" "NombreDeLaPestaña"
   ```
3. Sube el `data/products.json` actualizado al repositorio de GitHub (sustituye al
   anterior). En 1-2 minutos la app publicada ya usará los precios nuevos.

Si prefieres, puedo dejarte esto automatizado para que no tengas que tocar nada manualmente.

---

## Cómo funciona el cálculo (igual que en tu Excel)

Reproduce tu fórmula de descuentos en cascada, ahora con dos casillas de descuento extra
además del descuento base (para casos tipo 40+10+10). El **margen comercial** es editable
línea a línea: al añadir un producto se rellena con el "margen por defecto" de la cabecera,
pero puedes cambiarlo en cualquier línea y el precio neto se recalcula al momento.

```
Neto/ud = PVP × (1 − Descuento/100) × (1 − Extra1/100) × (1 − Extra2/100) / (1 − Margen/100)
Subtotal = Cantidad × Neto/ud
```

Totales de la oferta:

```
Neto sin RAEE ni IVA = Σ Subtotales
RAEE = Σ (RAEE/ud × Cantidad)
Base imponible = Neto + RAEE
IVA = Base imponible × % IVA
TOTAL = Base imponible + IVA
```

---

## Estructura del proyecto

```
index.html          Interfaz de la app (pestañas: Nueva oferta / Registro / Ajustes)
css/style.css        Estilos
js/catalog.js        Carga y búsqueda del catálogo de productos
js/store.js           Guardado local y sincronización con Firebase
js/pdf.js             Generación del PDF del presupuesto
js/app.js             Lógica de la aplicación (cálculo, líneas, registro)
data/products.json   Catálogo de productos exportado del Excel (8.718 referencias)
manifest.json         Configuración de la PWA (icono, nombre, instalación)
sw.js                 Service worker (funcionamiento offline)
tools/export_catalog.py  Script para regenerar el catálogo desde un Excel nuevo
```

## Reutilizar una oferta para otro cliente (duplicar)

Si abres una oferta ya guardada desde el Registro y quieres reutilizarla para otro cliente
u obra (cambiando cliente, productos o cantidades), usa el botón **"🧬 Duplicar como nueva
oferta"** en vez de "Guardar oferta". Esto crea una oferta nueva e independiente con los
cambios que hayas hecho, sin tocar ni sobrescribir la original.

"Guardar oferta" sigue sirviendo para corregir la oferta que tienes abierta en ese momento
(por ejemplo, si te equivocaste en una cantidad).

## Estado de la oferta (Pendiente / Ganada / Perdida)

En la cabecera de cada oferta hay un selector **"Estado de la oferta"** con tres opciones:
🟡 Pendiente, 🟢 Ganada, 🔴 Perdida. Al guardar, ese estado queda registrado.

En el **Registro** puedes filtrar por estado con el desplegable de arriba, y cada oferta
muestra su insignia de color correspondiente. El aviso de "pendiente de reclamar" (fila
sombreada en rojo por antigüedad de +2 meses) solo se aplica mientras la oferta sigue en
estado Pendiente: en cuanto la marcas como Ganada o Perdida, deja de avisarte por esa oferta.

Las ofertas nuevas y las duplicadas empiezan siempre en estado Pendiente.
