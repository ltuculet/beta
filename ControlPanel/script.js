document.addEventListener('DOMContentLoaded', () => {
    const btnApplyChanges = document.getElementById('btnApplyChanges');
    const statusMessages = document.getElementById('statusMessages');

    // Entradas de la interfaz
    const logoInput = document.getElementById('logo');
    const faviconInput = document.getElementById('favicon');
    const audioStreamUrlInput = document.getElementById('audioStreamUrl');
    const facebookUrlInput = document.getElementById('facebookUrl');
    const twitterUrlInput = document.getElementById('twitterUrl');
    const instagramUrlInput = document.getElementById('instagramUrl');
    const youtubeUrlInput = document.getElementById('youtubeUrl');
    const tiktokUrlInput = document.getElementById('tiktokUrl');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const whatsappInput = document.getElementById('whatsapp');

    // Tamaños de iconos estándar de la PWA (ejemplos, ajustar según la PWA real)
    const PWA_ICON_SIZES = [
        { name: 'images/icons/icon-72x72.png', width: 72, height: 72 },
        { name: 'images/icons/icon-96x96.png', width: 96, height: 96 },
        { name: 'images/icons/icon-128x128.png', width: 128, height: 128 },
        { name: 'images/icons/icon-144x144.png', width: 144, height: 144 },
        { name: 'images/icons/icon-152x152.png', width: 152, height: 152 },
        { name: 'images/icons/icon-192x192.png', width: 192, height: 192 },
        { name: 'images/icons/icon-384x384.png', width: 384, height: 384 },
        { name: 'images/icons/icon-512x512.png', width: 512, height: 512 },
        // Favicon (puede ser el mismo archivo o uno específico)
        { name: 'favicon.ico', width: 32, height: 32, isFavicon: true }, // Ejemplo, ajustar
        { name: 'images/favicon-16x16.png', width: 16, height: 16, isFavicon: true },
        { name: 'images/favicon-32x32.png', width: 32, height: 32, isFavicon: true },
        { name: 'images/apple-touch-icon.png', width: 180, height: 180, isFavicon: true } // Apple touch icon
    ];
    const PWA_LOGO_PATH = 'images/logo.png'; // Ajustar según la PWA

    btnApplyChanges.addEventListener('click', async () => {
        statusMessages.innerHTML = 'Procesando...';
        try {
            const zip = new JSZip();
            const pwaFilesToProcess = await listPwaFiles();

            // 1. Cargar y procesar imágenes
            const imageProcessingPromises = [];
            if (logoInput.files[0]) {
                const logoFile = logoInput.files[0];
                // Procesar para el logo principal de la PWA
                imageProcessingPromises.push(
                    processAndAddImageToZip(zip, logoFile, PWA_LOGO_PATH, { isLogo: true }) // Necesita una función específica o adaptar la existente
                );
                // Procesar para los iconos de la PWA que se basan en el logo
                PWA_ICON_SIZES.forEach(icon => {
                    if (!icon.isFavicon) { // Favicon se maneja por separado
                        imageProcessingPromises.push(
                            processAndAddImageToZip(zip, logoFile, icon.name, { width: icon.width, height: icon.height })
                        );
                    }
                });
            }

            if (faviconInput.files[0]) {
                const faviconFile = faviconInput.files[0];
                PWA_ICON_SIZES.forEach(icon => {
                    if (icon.isFavicon) {
                        imageProcessingPromises.push(
                            processAndAddImageToZip(zip, faviconFile, icon.name, { width: icon.width, height: icon.height })
                        );
                    }
                });
            }

            await Promise.all(imageProcessingPromises);
            logMessage('Imágenes procesadas y añadidas al ZIP.');

            // 2. Modificar archivos de la PWA (index.html, app.js, manifest.json)
            for (const filePath of pwaFilesToProcess) {
                if (filePath.startsWith('ControlPanel/')) continue; // No incluir el panel de control

                // Si ya fue procesada como imagen, no la leemos como texto.
                if (zip.file(filePath) && (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.ico'))) {
                    continue;
                }

                const response = await fetch(`../${filePath}`);
                if (!response.ok) {
                    logMessage(`Error al cargar el archivo ${filePath}: ${response.statusText}`, 'error');
                    continue;
                }

                let content = await response.text();

                if (filePath === 'index.html') {
                    content = customizePwaIndexHtml(content);
                    logMessage('index.html de la PWA personalizado.');
                } else if (filePath.endsWith('js/app.js')) { // Ajustar ruta si es necesario
                    content = customizePwaAppJs(content);
                    logMessage('app.js de la PWA personalizado.');
                } else if (filePath === 'manifest.json') {
                    content = await customizePwaManifest(content, zip); // Pasa zip para verificar si los iconos existen
                    logMessage('manifest.json de la PWA personalizado.');
                }
                // Añadir otros archivos tal cual si no son de imagen y no fueron procesados
                if (!zip.file(filePath)) {
                     zip.file(filePath, content);
                }
            }

            // Añadir archivos restantes que no fueron modificados (ej. CSS, otras JS, fuentes)
            // Esto se hace implicitamente si `pwaFilesToProcess` es completo y no se sobreescriben.
            // Asegurémonos de que todos los archivos estén.
            for (const filePath of pwaFilesToProcess) {
                if (filePath.startsWith('ControlPanel/')) continue;
                if (!zip.file(filePath)) { // Si el archivo no fue añadido (ej. no es imagen procesada, ni html, js, manifest)
                    const response = await fetch(`../${filePath}`);
                    if (response.ok) {
                        const blob = await response.blob();
                        zip.file(filePath, blob);
                    } else {
                        logMessage(`No se pudo añadir ${filePath} al ZIP.`, 'error');
                    }
                }
            }


            // 5. Generar y descargar ZIP
            zip.generateAsync({ type: 'blob' })
                .then(function (content) {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(content);
                    link.download = 'PWA_Personalizada.zip';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    logMessage('PWA personalizada generada y descarga iniciada.', 'success');
                })
                .catch(err => {
                    logMessage(`Error generando el ZIP: ${err.message}`, 'error');
                    console.error(err);
                });

        } catch (error) {
            logMessage(`Error en el proceso: ${error.message}`, 'error');
            console.error(error);
        }
    });

    async function listPwaFiles() {
        // Esta función debería simular la lectura de archivos del proyecto.
        // En un entorno real, esto podría ser una llamada a un endpoint del servidor
        // o, si es puramente frontend, necesitaríamos una lista predefinida o explorar el DOM/caché.
        // Por ahora, usaremos una lista hardcodeada basada en la estructura típica de la PWA dada.
        // ¡ESTO NECESITA SER AJUSTADO A LA ESTRUCTURA REAL DE LA PWA!
        logMessage("Listando archivos de la PWA (simulado)...");
        return [
            'index.html',
            'manifest.json',
            'sw.js', // Service Worker
            'css/style.css', // CSS principal
            'js/app.js', // JS principal
            'images/logo.png',
            'images/favicon-16x16.png',
            'images/favicon-32x32.png',
            'images/apple-touch-icon.png',
            'images/icons/icon-72x72.png',
            'images/icons/icon-96x96.png',
            'images/icons/icon-128x128.png',
            'images/icons/icon-144x144.png',
            'images/icons/icon-152x152.png',
            'images/icons/icon-192x192.png',
            'images/icons/icon-384x384.png',
            'images/icons/icon-512x512.png',
            // Añadir otros archivos/directorios como fuentes, assets, etc.
            // 'fonts/archivo-fuente.woff2',
        ];
    }

    function logMessage(message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = message;
        p.className = type; // 'info', 'success', 'error'
        statusMessages.appendChild(p);
        console.log(message);
    }

    async function processAndAddImageToZip(zip, file, targetPath, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = options;

                    if (options.isLogo) { // Si es el logo principal, usar sus dimensiones o un max.
                        // Aquí podrías decidir mantener las dimensiones originales o redimensionar
                        // si es demasiado grande. Por ahora, usamos las originales.
                        // O podrías tener un tamaño específico para PWA_LOGO_PATH
                        width = img.width;
                        height = img.height;
                    } else if (!width || !height) { // Si no se especifican dimensiones (ej. para favicon.ico original)
                        width = img.width;
                        height = img.height;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(blob => {
                        zip.file(targetPath, blob);
                        logMessage(`Imagen ${file.name} procesada y añadida como ${targetPath}`);
                        resolve();
                    }, file.type); // Mantener el tipo original si es posible, o 'image/png'
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function customizePwaIndexHtml(content) {
        let newContent = content;
        const audioUrl = audioStreamUrlInput.value.trim();
        if (audioUrl) {
            // Buscar una etiqueta específica o un comentario para reemplazar la URL del stream
            // Ejemplo: <audio id="audioStream" src="URL_PLACEHOLDER"></audio>
            // O un script: const streamUrl = "URL_PLACEHOLDER";
            // Esto es muy dependiente de la estructura de la PWA.
            // Haremos un reemplazo genérico, asumiendo que hay un placeholder.
            // Se recomienda usar un placeholder claro como <!-- AUDIO_STREAM_URL --> o similar en la PWA original.

            // Intento 1: Reemplazar en un atributo src de una etiqueta audio con id específico
            const audioTagRegex = /<audio[^>]*id=["']player["'][^>]*src=["']([^"']*)["'][^>]*>/;
            if (newContent.match(audioTagRegex)) {
                newContent = newContent.replace(audioTagRegex, (match, oldUrl) => match.replace(oldUrl, audioUrl));
                 logMessage(`URL de audio actualizada en etiqueta <audio id="player">.`);
            } else {
                // Intento 2: Reemplazar una variable JavaScript (ej. en un script dentro del HTML)
                const scriptVarRegex = /const\s+streamUrl\s*=\s*["']([^"']*)["'];/; // o let, o var
                if (newContent.match(scriptVarRegex)) {
                    newContent = newContent.replace(scriptVarRegex, (match, oldUrl) => match.replace(oldUrl, audioUrl));
                    logMessage(`URL de audio actualizada en variable JavaScript 'streamUrl'.`);
                } else {
                    // Intento 3: Placeholder genérico. Añadir <!-- AUDIO_STREAM_URL_PLACEHOLDER --> en la PWA.
                    const placeholder = '<!-- AUDIO_STREAM_URL_PLACEHOLDER -->';
                    if (newContent.includes(placeholder)) {
                        newContent = newContent.replace(placeholder, audioUrl);
                        logMessage(`URL de audio actualizada usando placeholder.`);
                    } else {
                        logMessage('No se encontró un lugar estándar para la URL de audio en index.html. Se necesita un placeholder o una estructura conocida.', 'warning');
                    }
                }
            }
        }
        // Aquí también se podrían actualizar títulos, metadatos si es necesario, etc.
        return newContent;
    }

    function customizePwaAppJs(content) {
        let newContent = content;
        const socialLinks = {
            facebook: facebookUrlInput.value.trim(),
            twitter: twitterUrlInput.value.trim(),
            instagram: instagramUrlInput.value.trim(),
            youtube: youtubeUrlInput.value.trim(),
            tiktok: tiktokUrlInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
            whatsapp: whatsappInput.value.trim(),
        };

        // Ejemplo de cómo podrían estar las URLs en app.js (esto es una suposición)
        // const socialMediaLinks = {
        //   facebook: { url: "URL_FB", active: false },
        //   twitter: { url: "URL_TW", active: false },
        //   // ... y así sucesivamente
        // };
        // O podrían ser líneas comentadas:
        // // habilitarRedSocial("facebook", "URL_FB");
        // // habilitarRedSocial("twitter", "URL_TW");

        for (const [key, url] of Object.entries(socialLinks)) {
            if (url) {
                // Opción 1: Si las URLs están en un objeto y hay una propiedad "active" o similar
                // const regexActive = new RegExp(`(${key}):\\s*{\\s*url:\\s*["'][^"']*["'],\\s*active:\\s*false\\s*}`, 'i');
                // newContent = newContent.replace(regexActive, `$1: { url: "${url}", active: true }`);

                // Opción 2: Descomentar y reemplazar URL en una línea específica
                // Buscar algo como: // nombreFuncion('facebook', 'DEFAULT_URL_FB');
                // O: // elementFacebook.href = 'DEFAULT_URL_FB';
                // Esta es la opción más probable según el requerimiento de "descomentar"
                const commentedLineRegex = new RegExp(`//(.*)${key}(.*)URL_PLACEHOLDER_FOR_${key.toUpperCase()}(.*)`, 'gm');
                const commentedLineRegexGeneric = new RegExp(`//(.*['"]#?${key}['"]|${key}Link.*=.*)("DEFAULT_URL"|'DEFAULT_URL'|"#")`, 'gm');

                // Intenta encontrar una línea comentada específica para esta red social y la descomenta/actualiza
                // Ejemplo: // showSocialIcon('facebook', 'OLD_URL');
                const specificCommentedRegex = new RegExp(`^\\s*//\\s*(.*${key}.*["'])[^"']+(["'].*)`, 'gm');
                if (specificCommentedRegex.test(newContent)) {
                    newContent = newContent.replace(specificCommentedRegex, (match, p1, p2) => `${p1}${url}${p2}`);
                    logMessage(`Red social ${key} descomentada y URL actualizada a: ${url}`);
                } else {
                    // Intento más genérico si hay placeholders como 'URL_FACEBOOK_PLACEHOLDER'
                    const placeholderRegex = new RegExp(`('URL_${key.toUpperCase()}_PLACEHOLDER'|"URL_${key.toUpperCase()}_PLACEHOLDER")`, 'g');
                     if (placeholderRegex.test(newContent)) {
                        newContent = newContent.replace(placeholderRegex, `"${url}"`);
                        // Adicionalmente, buscar una línea comentada que la habilite
                        // ej: // activateSocial('${key}');
                        const activationCommentRegex = new RegExp(`^\\s*//\\s*(activateSocial\\(['"]${key}['"]\\);)`, 'gm');
                        newContent = newContent.replace(activationCommentRegex, '$1');
                        logMessage(`Red social ${key} activada y URL actualizada a: ${url} usando placeholder.`);
                    } else {
                        logMessage(`No se encontró un patrón claro para descomentar/actualizar ${key} en app.js. Se requiere un formato específico en el código PWA.`, 'warning');
                    }
                }
            } else {
                // Si la URL está vacía, asegurarse de que la línea permanezca comentada o se comente.
                // Esto es más complejo, ya que necesitaríamos saber cómo se "activa" para comentarlo.
                // Por ahora, asumimos que si no se provee URL, no se descomenta nada.
                // Si la PWA tiene las líneas activas por defecto y queremos comentarlas si el campo está vacío:
                // const activeLineRegex = new RegExp(`^(\\s*[^/].*${key}.*["'])${[^"']}+(["'].*)`, 'gm');
                // newContent = newContent.replace(activeLineRegex, `// $1${"DEFAULT_OR_EMPTY"}$2`);
                 logMessage(`URL para ${key} está vacía, se mantendrá comentada o inactiva.`, 'info');
            }
        }
        return newContent;
    }

    async function customizePwaManifest(content, zip) {
        try {
            const manifest = JSON.parse(content);

            // Actualizar nombre de la app, short_name, etc., si se añaden campos para ello.
            // manifest.name = "Nombre Personalizado de la App";
            // manifest.short_name = "App Corto";

            // Actualizar iconos en el manifest
            if (manifest.icons && Array.isArray(manifest.icons)) {
                manifest.icons.forEach(icon => {
                    // Verificar si el icono correspondiente fue generado y añadido al zip
                    // Esto asegura que solo listemos iconos que realmente existirán.
                    const iconPathInZip = icon.src.startsWith('/') ? icon.src.substring(1) : icon.src;
                    if (zip.file(iconPathInZip)) {
                        // El icono ya está (o estará) en el ZIP con el path correcto.
                        // Podríamos querer actualizar `sizes` o `type` si el procesamiento de imagen cambió eso,
                        // pero `processAndAddImageToZip` intenta mantener el tipo y usa las dimensiones definidas.
                        logMessage(`Icono ${icon.src} confirmado en manifest.`);
                    } else {
                        logMessage(`Icono ${icon.src} listado en manifest.json NO fue encontrado/procesado para el ZIP. Podría causar problemas.`, 'warning');
                        // Opcionalmente, removerlo del manifest si no existe:
                        // manifest.icons = manifest.icons.filter(i => i.src !== icon.src);
                    }
                });
            }

            // Si se subió un nuevo logo y se generaron iconos, asegurarse de que los paths en manifest.json
            // coincidan con los paths usados en PWA_ICON_SIZES y processAndAddImageToZip.
            // Por ejemplo, si PWA_ICON_SIZES tiene 'images/icons/icon-192x192.png', manifest.json debe referenciarlo.
            // Si el manifest original tiene diferentes paths, necesitaríamos mapearlos o cambiar los paths en PWA_ICON_SIZES.
            // El código actual asume que los paths en PWA_ICON_SIZES son los que el manifest espera.

            return JSON.stringify(manifest, null, 2);
        } catch (e) {
            logMessage(`Error al parsear o modificar manifest.json: ${e.message}`, 'error');
            return content; // Devuelve el original si hay error
        }
    }
});
