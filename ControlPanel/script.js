document.addEventListener('DOMContentLoaded', () => {
    const btnApplyChanges = document.getElementById('btnApplyChanges');
    const statusMessages = document.getElementById('statusMessages');

    // Entradas de la interfaz
    const mainLogoInput = document.getElementById('logo'); // Renombrado para claridad
    const faviconsInput = document.getElementById('favicon'); // Renombrado para claridad
    const audioStreamUrlInput = document.getElementById('audioStreamUrl');
    const facebookUrlInput = document.getElementById('facebookUrl');
    const twitterUrlInput = document.getElementById('twitterUrl');
    const instagramUrlInput = document.getElementById('instagramUrl');
    const youtubeUrlInput = document.getElementById('youtubeUrl');
    const tiktokUrlInput = document.getElementById('tiktokUrl');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const whatsappInput = document.getElementById('whatsapp');

    // Elementos de previsualización
    const logoPreview = document.getElementById('logoPreview'); // Preview junto al input
    const faviconPreview = document.getElementById('faviconPreview'); // Preview junto al input
    const previewContainer = document.getElementById('previewContainer');
    const finalLogoPreview = document.getElementById('finalLogoPreview'); // Preview en la sección de resumen
    const noLogoPreview = document.getElementById('noLogoPreview');
    const finalFaviconPreview = document.getElementById('finalFaviconPreview'); // Preview en la sección de resumen
    const noFaviconPreview = document.getElementById('noFaviconPreview');
    const audioStreamPreviewDiv = document.getElementById('audioStreamPreview').querySelector('span');
    const socialLinksPreviewUl = document.getElementById('socialLinksPreview').querySelector('ul');
    const btnPreview = document.getElementById('btnPreview');


    // Tamaños de iconos definidos en manifest.json y encontrados en img/
    const PWA_ICON_SIZES_AND_PATHS = [
        { name: 'img/16.png', width: 16, height: 16 },
        { name: 'img/32.png', width: 32, height: 32 },
        { name: 'img/64.png', width: 64, height: 64 },
        { name: 'img/96.png', width: 96, height: 96 },
        { name: 'img/128.png', width: 128, height: 128 },
        { name: 'img/192.png', width: 192, height: 192 },
        { name: 'img/256.png', width: 256, height: 256 },
        { name: 'img/384.png', width: 384, height: 384 },
        { name: 'img/512.png', width: 512, height: 512 },
        { name: 'img/1024.png', width: 1024, height: 1024 },
        // No hay un favicon.ico explícito, los PNGs del manifest son usados.
        // No hay apple-touch-icon explícito, iOS puede usar los iconos del manifest.
    ];
    const PWA_MAIN_LOGO_PATH = 'assets/imgs/perfil.png'; // Logo principal visible en la app

    btnApplyChanges.addEventListener('click', async () => {
        statusMessages.innerHTML = ''; // Limpiar mensajes previos
        logMessage('Iniciando proceso de personalización...');
        try {
            const zip = new JSZip();
            const pwaFilesToProcess = await listPwaFiles();

            // 1. Cargar y procesar imágenes
            const imageProcessingPromises = [];

            // Procesar el logo principal de la app (assets/imgs/perfil.png)
            if (mainLogoInput.files[0]) {
                imageProcessingPromises.push(
                    processAndAddImageToZip(zip, mainLogoInput.files[0], PWA_MAIN_LOGO_PATH, { originalSize: true }) // Mantener tamaño original o definir uno específico
                );
            }

            // Procesar los iconos (los que van en img/ y se listan en manifest.json)
            // Se usará el archivo de "faviconsInput" para generar todos estos tamaños.
            if (faviconsInput.files[0]) {
                const sourceIconFile = faviconsInput.files[0];
                PWA_ICON_SIZES_AND_PATHS.forEach(iconDef => {
                    imageProcessingPromises.push(
                        processAndAddImageToZip(zip, sourceIconFile, iconDef.name, { width: iconDef.width, height: iconDef.height })
                    );
                });
            }

            await Promise.all(imageProcessingPromises);
            if (imageProcessingPromises.length > 0) {
                logMessage('Imágenes procesadas y añadidas al ZIP.');
            } else {
                logMessage('No se cargaron nuevas imágenes.');
            }

            // 2. Leer, modificar y añadir archivos de la PWA al ZIP
            for (const filePath of pwaFilesToProcess) {
                if (filePath.startsWith('ControlPanel/')) continue;

                // Las imágenes ya fueron (o serán) manejadas por processAndAddImageToZip y añadidas al zip.
                // Si no se cargó una imagen nueva para un path específico, debemos cargar la original.
                const isImageAsset = PWA_ICON_SIZES_AND_PATHS.some(p => p.name === filePath) || filePath === PWA_MAIN_LOGO_PATH;

                if (isImageAsset && zip.file(filePath)) {
                    // Ya fue procesada y añadida (o al menos, un archivo con ese path fue añadido)
                    logMessage(`Imagen ${filePath} ya gestionada (posiblemente actualizada).`, 'debug');
                    continue;
                }

                const response = await fetch(`../${filePath}`); // Fetch desde la raíz del proyecto
                if (!response.ok) {
                    logMessage(`Error al cargar el archivo ${filePath}: ${response.statusText}`, 'error');
                    continue;
                }

                // Para archivos de texto que necesitan modificación
                if (filePath === 'index.html' || filePath === 'assets/js/main_player.js' || filePath === 'manifest.json') {
                    let content = await response.text();
                    let modified = false;

                    if (filePath === 'index.html') {
                        const originalContent = content;
                        content = customizePwaIndexHtml(content);
                        if (content !== originalContent) {
                             logMessage('index.html de la PWA personalizado.');
                             modified = true;
                        }
                    } else if (filePath === 'assets/js/main_player.js') {
                        const originalContent = content;
                        content = customizeMainPlayerJs(content);
                         if (content !== originalContent) {
                            logMessage('assets/js/main_player.js de la PWA personalizado.');
                            modified = true;
                        }
                    } else if (filePath === 'manifest.json') {
                        const originalContent = content;
                        content = await customizePwaManifest(content, zip); // Pasa zip para verificar si los iconos existen
                        if (content !== originalContent) {
                            logMessage('manifest.json de la PWA personalizado.');
                            modified = true;
                        }
                    }
                    zip.file(filePath, content);
                    if (!modified && !zip.file(filePath)) { // Si no se modificó y no estaba ya (por si acaso)
                        zip.file(filePath, await response.blob()); // Añadir como blob si no hubo cambios textuales
                        logMessage(`Archivo ${filePath} añadido al ZIP (sin modificar).`, 'debug');
                    } else if (modified) {
                        logMessage(`Archivo ${filePath} añadido al ZIP (modificado).`, 'debug');
                    }


                } else { // Otros archivos (CSS, otros JS, fuentes, imágenes no reemplazadas, etc.)
                    if (!zip.file(filePath)) { // Asegurarse de no añadirlo dos veces
                        const blob = await response.blob();
                        zip.file(filePath, blob);
                        logMessage(`Archivo ${filePath} añadido al ZIP (sin modificar).`, 'debug');
                    }
                }
            }

            // Generar y descargar ZIP
            logMessage('Generando archivo ZIP...');
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
        // Ajustado a la estructura real de la PWA según el `ls` y análisis.
        logMessage("Listando archivos de la PWA...", "debug");
        const baseFiles = [
            'index.html',
            'manifest.json',
            'script.js', // Este es el script.js de la raíz
            'sw.js',
            'install.js',
            // Directorio img/ (los PNGs se manejan arriba, pero si hay otros como nocover.png, copy.png)
            'img/nocover.png',
            'img/copy.png',
        ];

        // Añadir todos los iconos de PWA_ICON_SIZES_AND_PATHS a la lista de archivos a empaquetar
        PWA_ICON_SIZES_AND_PATHS.forEach(icon => baseFiles.push(icon.name));
        baseFiles.push(PWA_MAIN_LOGO_PATH); // Añadir el logo principal

        // Listar archivos de assets de forma más dinámica o especificar los conocidos
        // Por ahora, una lista más explícita basada en lo que vimos.
        // Idealmente, esto podría venir de un `ls` real en el servidor o una herramienta de build.
        const assetFiles = [
            'assets/boot/mdb.dark.min.css',
            'assets/boot/mdb.min.js',
            'assets/css/style.css',
            'assets/fonts/mox/style.css',
            // Asumimos que las fuentes dentro de assets/fonts/mox/fonts/ y assets/fonts/threads/fonts/
            // son referenciadas por sus respectivos style.css y serán cargadas por el navegador.
            // Para incluirlas en el ZIP explícitamente si no se obtienen por `fetch` transitivo:
            // (Esto requeriría una forma de listar los archivos de esos directorios)
            // 'assets/fonts/mox/fonts/font1.woff2', ...etc.
            'assets/fonts/threads/style.css',
            'assets/imgs/Q0lVKhfzgM.json', // Animación Lottie
            // assets/imgs/perfil.png ya está en PWA_MAIN_LOGO_PATH
            'assets/js/api.json', // Aunque no se usa directamente en el player, puede ser parte de la app
            'assets/js/main_player.js',
            'assets/js/moment.js',
        ];

        // Simular la obtención de todos los archivos recursivamente para directorios como assets/fonts
        // Esta es una simplificación. En un entorno real, el servidor listaría estos archivos.
        // O necesitaríamos una lista exhaustiva.
        // Por ahora, nos basamos en los archivos explícitamente listados.

        const allFiles = [...baseFiles, ...assetFiles];
        logMessage(`Archivos a procesar para el ZIP: ${allFiles.length}`, "debug");
        return allFiles;
    }

    function logMessage(message, type = 'info') { // type puede ser 'info', 'success', 'error', 'warning', 'debug'
        const p = document.createElement('p');
        p.textContent = message;
        p.className = type;
        statusMessages.appendChild(p);
        if (type === 'error' || type === 'warning') {
            console[type](message);
        } else {
            console.log(message);
        }
    }

    async function processAndAddImageToZip(zip, file, targetPath, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let targetWidth, targetHeight;

                    if (options.originalSize) { // Para el logo principal assets/imgs/perfil.png
                        targetWidth = img.width;
                        targetHeight = img.height;
                    } else { // Para los iconos de img/
                        targetWidth = options.width;
                        targetHeight = options.height;
                    }

                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                    canvas.toBlob(blob => {
                        if (blob) {
                            zip.file(targetPath, blob);
                            logMessage(`Imagen ${file.name} procesada y añadida como ${targetPath} (${targetWidth}x${targetHeight})`);
                        } else {
                            logMessage(`Error al generar blob para ${targetPath} (canvas.toBlob devolvió null)`, 'error');
                        }
                        resolve();
                    }, 'image/png'); // Forzar PNG para consistencia de iconos, o usar file.type si se prefiere mantener original
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    function customizePwaIndexHtml(originalContent) {
        let newContent = originalContent;

        // 1. Actualizar logo principal visible (./assets/imgs/perfil.png)
        // Esta imagen es referenciada en index.html. Si se carga un nuevo logo,
        // la imagen en PWA_MAIN_LOGO_PATH será la nueva. No se necesita cambiar el HTML
        // a menos que el path del logo cambie, lo cual no es el caso aquí.
        // La personalización del logo principal (nombre de la app, slogan) no está implementada aún,
        // pero se podría hacer aquí si se añaden campos para ello.
        // Ejemplo: const appName = document.getElementById('appNameInput').value;
        // newContent = newContent.replace(/<div class="cnt__logo position-absolute">\s*<img src=".\/assets\/imgs\/perfil.png">\s*<span>Pasión por el Hi-Fi<\/span>/,
        //                                 `<div class="cnt__logo position-absolute"><img src="./assets/imgs/perfil.png"><span>${appName || 'Pasión por el Hi-Fi'}</span>`);

        // 2. Actualizar Redes Sociales
        const socialMediaPlaceholders = {
            facebook: { find: /<!--<li><a href="#"><i class="fa-brands fa-facebook-f"><\/i><\/a><\/li>-->/, replace: '<li><a href="{url}" target="_blank"><i class="fa-brands fa-facebook-f"></i></a></li>' },
            instagram: { find: /<!--<li><a href="#"><i class="fa-brands fa-instagram"><\/i><\/a><\/li>-->/, replace: '<li><a href="{url}" target="_blank"><i class="fa-brands fa-instagram"></i></a></li>' },
            twitter: { find: /<!--<li><a href="#"><i class="fa-brands fa-x-twitter"><\/i><\/a><\/li>-->/, replace: '<li><a href="{url}" target="_blank"><i class="fa-brands fa-x-twitter"></i></a></li>' }, // X-Twitter
            youtube: { find: /<!--<li><a href="#"><i class="fa-brands fa-youtube"><\/i><\/a><\/li>-->/, replace: '<li><a href="{url}" target="_blank"><i class="fa-brands fa-youtube"></i></a></li>' },
            tiktok: { find: /<!--<li><a href="#"><i class="fa-brands fa-tiktok"><\/i><\/a><\/li>-->/, replace: '<li><a href="{url}" target="_blank"><i class="fa-brands fa-tiktok"></i></a></li>' },
            // Threads no tiene un input directo, pero si se quisiera:
            // threads: { find: /<!--<li><a href="#"><i class="fa-brands fa-threads"><\/i><\/a><\/li>-->/, replace: '<li><a href="{url}" target="_blank"><i class="fa-brands fa-threads"></i></a></li>' },
        };

        let socialHtmlChanged = false;
        for (const key in socialMediaPlaceholders) {
            const inputElement = document.getElementById(`${key}Url`); // e.g., facebookUrl
            if (inputElement) {
                const url = inputElement.value.trim();
                if (url) {
                    newContent = newContent.replace(socialMediaPlaceholders[key].find, socialMediaPlaceholders[key].replace.replace('{url}', url));
                    logMessage(`Red social ${key} activada con URL: ${url}`, 'debug');
                    socialHtmlChanged = true;
                } else {
                    // Asegurarse de que sigue comentado si no hay URL (ya lo está por defecto)
                }
            }
        }

        // WhatsApp: ya está descomentado, solo actualizar URL
        const whatsappVal = whatsappInput.value.trim();
        if (whatsappVal) {
            const whatsappRegex = /<a href="https:\/\/wa\.me\/[^"]+">/;
            const newWhatsappLink = `<a href="https://wa.me/${whatsappVal.replace('+', '')}">`;
            if (newContent.match(whatsappRegex)) {
                newContent = newContent.replace(whatsappRegex, newWhatsappLink);
                logMessage(`WhatsApp URL actualizada a: https://wa.me/${whatsappVal}`, 'debug');
                socialHtmlChanged = true;
            }
        }

        // Email y Teléfono: no tienen placeholders, hay que añadirlos si se proporcionan
        const emailVal = emailInput.value.trim();
        const phoneVal = phoneInput.value.trim();
        let newLinksHtml = '';
        if (emailVal) {
            newLinksHtml += `<li><a href="mailto:${emailVal}"><i class="fa-solid fa-envelope"></i></a></li>\n`;
            logMessage(`Email añadido: ${emailVal}`, 'debug');
            socialHtmlChanged = true;
        }
        if (phoneVal) {
            newLinksHtml += `<li><a href="tel:${phoneVal}"><i class="fa-solid fa-phone"></i></a></li>\n`;
            logMessage(`Teléfono añadido: ${phoneVal}`, 'debug');
            socialHtmlChanged = true;
        }

        if (newLinksHtml) {
            const redesUlRegex = /(<div class="redes">\s*<ul>)/;
            newContent = newContent.replace(redesUlRegex, `$1\n${newLinksHtml}`);
        }

        if (socialHtmlChanged) {
            logMessage('Sección de redes sociales en index.html actualizada.');
        }

        // Podríamos añadir personalización de título aquí también
        // const appTitle = document.getElementById('appTitleInput').value; // Si tuvieramos este campo
        // if (appTitle) newContent = newContent.replace(/<title>.*<\/title>/, `<title>${appTitle}</title>`);

        return newContent;
    }

    // Renombrada de customizePwaAppJs a customizeMainPlayerJs
    function customizeMainPlayerJs(originalContent) {
        let newContent = originalContent;
        const socialLinks = {
            facebook: facebookUrlInput.value.trim(),
            twitter: twitterUrlInput.value.trim(),
            instagram: instagramUrlInput.value.trim(),
            youtube: youtubeUrlInput.value.trim(),
            tiktok: tiktokUrlInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
            whatsapp: whatsappInput.value.trim(), // Este se maneja en index.html directamente
        };

        const audioUrl = audioStreamUrlInput.value.trim();
        if (audioUrl) {
            // Reemplazar la streamUrl en el objeto APP_CONFIG
            // const APP_CONFIG = { streamUrl: "VIEJA_URL", apiUrl: "..." };
            const streamUrlRegex = /(streamUrl\s*:\s*["'])([^"']*)(["'])/;
            if (newContent.match(streamUrlRegex)) {
                newContent = newContent.replace(streamUrlRegex, `$1${audioUrl}$3`);
                logMessage(`URL de stream de audio actualizada en main_player.js a: ${audioUrl}`);
            } else {
                logMessage('No se encontró el patrón de streamUrl en main_player.js para reemplazar.', 'warning');
            }
        }

        // La apiUrl no se está personalizando por ahora. Si se quisiera, se haría similar.
        // const apiUrlVal = document.getElementById('apiUrlInput').value.trim(); // Si existiera este campo
        // if (apiUrlVal) {
        //     const apiUrlRegex = /(apiUrl\s*:\s*["'])([^"']*)(["'])/;
        //     newContent = newContent.replace(apiUrlRegex, `$1${apiUrlVal}$3`);
        // }

        // Las redes sociales se manejan en index.html, no en este archivo.
        // El script.js de la raíz tampoco maneja estas URLs.

        return newContent;
    }

    async function customizePwaManifest(originalContent, zip) {
        let manifestChanged = false;
        try {
            const manifest = JSON.parse(originalContent);

            // TODO: Añadir campos en el HTML para personalizar estos valores si se desea
            // const appName = document.getElementById('manifestAppNameInput').value.trim();
            // const shortName = document.getElementById('manifestShortNameInput').value.trim();
            // const description = document.getElementById('manifestDescriptionInput').value.trim();
            // const themeColor = document.getElementById('manifestThemeColorInput').value.trim();
            // const backgroundColor = document.getElementById('manifestBgColorInput').value.trim();

            // Ejemplo:
            // if (appName && manifest.name !== appName) { manifest.name = appName; manifestChanged = true; }
            // if (shortName && manifest.short_name !== shortName) { manifest.short_name = shortName; manifestChanged = true; }
            // ...etc.

            // Verificar que los iconos referenciados en el manifest existan en el zip
            // (ya sea el original o el recién procesado)
            if (manifest.icons && Array.isArray(manifest.icons)) {
                manifest.icons.forEach(icon => {
                    const iconPathInManifest = icon.src.startsWith('./') ? icon.src.substring(2) : icon.src;
                    if (zip.file(iconPathInManifest)) {
                        logMessage(`Icono ${icon.src} del manifest confirmado en el ZIP.`, 'debug');
                    } else {
                        // Esto podría pasar si el manifest original lista un icono que no está en PWA_ICON_SIZES_AND_PATHS
                        // y no se subió un "favicon" para generarlo.
                        logMessage(`Icono ${icon.src} listado en manifest.json NO fue encontrado/procesado para el ZIP. Podría causar problemas.`, 'warning');
                    }
                });
            }
             // La estructura de PWA_ICON_SIZES_AND_PATHS ya coincide con el manifest.json,
            // así que no es necesario modificar las entradas de los iconos a menos que
            // se cambien nombres de archivo o se añadan/quiten iconos dinámicamente.
            // Si se subió un `faviconsInput`, las imágenes en `img/` serán reemplazadas.
            // El manifest ya apunta a esas rutas.

            if (manifestChanged) {
                 logMessage('manifest.json ha sido modificado.');
            }
            return JSON.stringify(manifest, null, 2);

        } catch (e) {
            logMessage(`Error al parsear o modificar manifest.json: ${e.message}`, 'error');
            return originalContent; // Devuelve el original si hay error
        }
    }

    // --- Lógica de Previsualización ---
    mainLogoInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                logoPreview.src = e.target.result;
                logoPreview.style.display = 'block';
                finalLogoPreview.src = e.target.result; // Actualizar también en el resumen
                finalLogoPreview.style.display = 'block';
                noLogoPreview.style.display = 'none';
            }
            reader.readAsDataURL(this.files[0]);
        } else {
            logoPreview.style.display = 'none';
            finalLogoPreview.style.display = 'none';
            noLogoPreview.style.display = 'block';
        }
    });

    faviconsInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                faviconPreview.src = e.target.result;
                faviconPreview.style.display = 'block';
                finalFaviconPreview.src = e.target.result; // Actualizar también en el resumen
                finalFaviconPreview.style.display = 'block';
                noFaviconPreview.style.display = 'none';
            }
            reader.readAsDataURL(this.files[0]);
        } else {
            faviconPreview.style.display = 'none';
            finalFaviconPreview.style.display = 'none';
            noFaviconPreview.style.display = 'block';
        }
    });

    function updateDataPreviews() {
        // Audio Stream URL
        audioStreamPreviewDiv.textContent = audioStreamUrlInput.value.trim() || 'No establecida';

        // Social Media Links
        socialLinksPreviewUl.innerHTML = ''; // Limpiar lista anterior
        const socialInputs = [
            { el: facebookUrlInput, name: 'Facebook' }, { el: twitterUrlInput, name: 'Twitter/X' },
            { el: instagramUrlInput, name: 'Instagram' }, { el: youtubeUrlInput, name: 'YouTube' },
            { el: tiktokUrlInput, name: 'TikTok' }, { el: emailInput, name: 'Email' },
            { el: phoneInput, name: 'Teléfono' }, { el: whatsappInput, name: 'WhatsApp' }
        ];
        let hasSocialLinks = false;
        socialInputs.forEach(item => {
            const url = item.el.value.trim();
            if (url) {
                const li = document.createElement('li');
                li.textContent = `${item.name}: ${url}`;
                socialLinksPreviewUl.appendChild(li);
                hasSocialLinks = true;
            }
        });
        if (!hasSocialLinks) {
            const li = document.createElement('li');
            li.textContent = 'No se han ingresado URLs de redes sociales.';
            socialLinksPreviewUl.appendChild(li);
        }

        // Mostrar previsualización de imágenes si no hay archivos cargados
        if (!mainLogoInput.files[0]) {
            finalLogoPreview.style.display = 'none';
            noLogoPreview.style.display = 'block';
        }
        if (!faviconsInput.files[0]) {
            finalFaviconPreview.style.display = 'none';
            noFaviconPreview.style.display = 'block';
        }
    }

    // Event listeners para actualizar previsualizaciones de datos de texto dinámicamente
    const textInputsForPreview = [
        audioStreamUrlInput, facebookUrlInput, twitterUrlInput, instagramUrlInput,
        youtubeUrlInput, tiktokUrlInput, emailInput, phoneInput, whatsappInput
    ];
    textInputsForPreview.forEach(input => {
        input.addEventListener('input', () => {
            if (previewContainer.style.display === 'block') { // Actualizar solo si la preview está visible
                updateDataPreviews();
            }
        });
    });

    btnPreview.addEventListener('click', () => {
        if (previewContainer.style.display === 'none' || previewContainer.style.display === '') {
            updateDataPreviews(); // Actualizar datos antes de mostrar
            previewContainer.style.display = 'block';
            btnPreview.textContent = 'Ocultar Previsualización de Datos';
        } else {
            previewContainer.style.display = 'none';
            btnPreview.textContent = 'Mostrar/Actualizar Previsualización de Datos';
        }
    });

    // Inicializar estado de previsualización de imágenes al cargar
    noLogoPreview.style.display = 'block';
    finalLogoPreview.style.display = 'none';
    noFaviconPreview.style.display = 'block';
    finalFaviconPreview.style.display = 'none';
});
