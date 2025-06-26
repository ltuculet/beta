'use strict';
let deferredInstallPrompt = null;
const installButton = document.getElementById('btnInstall');
installButton.addEventListener('click', installPWA);

window.addEventListener('beforeinstallprompt', saveBeforeInstallPromptEvent);

function saveBeforeInstallPromptEvent(evt){
    deferredInstallPrompt = evt;
    installButton.removeAttribute('hidden');
}

function installPWA(evt){
    deferredInstallPrompt.prompt();
    evt.srcElement.setAttribute('hidden', true);
    deferredInstallPrompt.userChoice.then((choice)=>{
        if(choice.outcome === "accepted"){
            console.log("ACEPTADO")
        }else{
            console.log("NO ACEPTADO")
        }
        deferredInstallPrompt = null;
    })

}
window.addEventListener('appinstalled', logAppInstalled);

function logappinstalled(evt){
    console.log("APP Instalada");
}