/* ==========================================================================
   GESTION ADMINISTRATIVE (SCRIPT.JS)
   ========================================================================== */
import { db, auth } from './js/config.js';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// AJOUT DE sendPasswordResetEmail ICI vvv
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { chargerLogoBase64, getVal } from './js/utils.js';
import { genererPouvoir, genererDeclaration, genererDemandeInhumation, genererDemandeCremation, genererDemandeRapatriement, genererDemandeFermetureMairie, genererDemandeOuverture, genererFermeture, genererTransport } from './js/pdf_admin.js';

// ATTACHER LES FONCTIONS AU WINDOW
window.genererPouvoir = genererPouvoir;
window.genererDeclaration = genererDeclaration;
window.genererDemandeInhumation = genererDemandeInhumation;
window.genererDemandeCremation = genererDemandeCremation;
window.genererDemandeRapatriement = genererDemandeRapatriement;
window.genererDemandeFermetureMairie = genererDemandeFermetureMairie;
window.genererDemandeOuverture = genererDemandeOuverture;
window.genererFermeture = genererFermeture;
window.genererTransport = genererTransport;

let currentDocId = null;

/* ==========================================================================
   1. AUTHENTIFICATION & NAVIGATION
   ========================================================================== */
/* ==========================================================================
   1. AUTHENTIFICATION & NAVIGATION (SÉCURISÉE)
   ========================================================================== */

// Fonction de Connexion
window.loginFirebase = function() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const btn = document.querySelector('.btn-login');
    const errorBox = document.getElementById('login-error-box');
    const loginBox = document.querySelector('.login-box');

    // 1. Reset visuel
    errorBox.classList.add('hidden');
    loginBox.classList.remove('shake');
    
    // 2. Vérification simple
    if (!email || !password) {
        showLoginError("Veuillez remplir tous les champs.");
        return;
    }

    // 3. UI Chargement
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification...';
    btn.disabled = true;

    // 4. Appel Firebase
    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            // SUCCÈS : On laisse onAuthStateChanged gérer la transition
            // (La redirection visuelle se fera automatiquement ci-dessous)
        })
        .catch((error) => {
            // ÉCHEC : Message générique pour sécurité
            console.error("Erreur technique:", error.code); // Pour vous (dev)
            
            // On remet le bouton
            btn.innerHTML = originalText;
            btn.disabled = false;

            // Message "Prestige" (ne dit pas si c'est l'email ou le mdp qui est faux)
            showLoginError("Identifiants incorrects. Veuillez réessayer.");
        });
};

// Afficher l'erreur joliment
function showLoginError(msg) {
    const errorBox = document.getElementById('login-error-box');
    const loginBox = document.querySelector('.login-box');
    
    document.getElementById('error-text').textContent = msg;
    errorBox.classList.remove('hidden');
    
    // Petite animation de secousse
    loginBox.classList.add('shake');
    setTimeout(() => loginBox.classList.remove('shake'), 500);
}

// SURVEILLANCE DE L'ÉTAT (C'est lui qui gère l'affichage des écrans)
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const hubScreen = document.getElementById('hub-accueil');

    if (user) {
        // --- UTILISATEUR CONNECTÉ ---
        
        // 1. Animation de sortie du login
        loginScreen.classList.add('fade-out');
        
        // 2. Affichage du Hub
        if(hubScreen) hubScreen.classList.remove('hidden');

        // 3. Suppression totale du login après l'animation (500ms)
        setTimeout(() => {
            loginScreen.style.display = 'none'; // On le retire vraiment du flux
        }, 500);

        // GESTION DU RETOUR DEPUIS FACTURATION (Paramètre ?open_id=...)
        const urlParams = new URLSearchParams(window.location.search);
        const openId = urlParams.get('open_id');
        
        if(openId) {
            hubScreen.classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            window.openTab('tab-dossier');
            setTimeout(() => window.chargerDossier(openId), 500); 
        }

    } else {
        // --- UTILISATEUR DÉCONNECTÉ ---
        loginScreen.style.display = 'flex';
        loginScreen.classList.remove('fade-out');
        if(hubScreen) hubScreen.classList.add('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
});

// Déconnexion propre
window.logout = function() {
    signOut(auth).then(() => {
        // Le onAuthStateChanged va automatiquement remettre l'écran de login
        window.location.href = "index.html"; 
    }).catch((error) => console.error(error));
};

/* ==========================================================================
   2. GESTION DU MOT DE PASSE (MODALE INTERNE)
   ========================================================================== */

window.ouvrirModalMdp = function() {
    document.getElementById('modal-mdp').classList.remove('hidden');
    document.getElementById('new-password').value = "";
};

window.fermerModalMdp = function() {
    document.getElementById('modal-mdp').classList.add('hidden');
};

window.validerNouveauMdp = async function() {
    const newPass = document.getElementById('new-password').value;
    if (newPass.length < 6) {
        alert("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }
    const user = auth.currentUser;
    if (user) {
        try {
            await updatePassword(user, newPass);
            alert("Mot de passe modifié avec succès !");
            window.fermerModalMdp();
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Par sécurité, veuillez vous reconnecter avant de modifier le mot de passe.");
                window.logout();
            } else {
                alert("Erreur : " + error.message);
            }
        }
    } else {
        alert("Erreur : Utilisateur non connecté.");
    }
};

/* ==========================================================================
   3. GESTION ADMINISTRATIVE (CRUD)
   ========================================================================== */

// Sauvegarder
window.sauvegarderClient = async function() {
    const btn = document.querySelector('.btn-green');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Envoi...';
    
    try {
        const data = {};
        document.querySelectorAll('input, select').forEach(el => {
            if(el.id && el.type !== 'submit' && el.type !== 'button') {
                if(el.type === 'checkbox') data[el.id] = el.checked;
                else if(el.type === 'radio') { if(el.checked) data[el.name] = el.value; }
                else data[el.id] = el.value;
            }
        });
        
        data.lastModified = new Date().toISOString();
        if(!data.dateCreation) data.dateCreation = new Date().toISOString();

        if (currentDocId) {
            await updateDoc(doc(db, "dossiers_clients", currentDocId), data);
            alert("Dossier mis à jour !");
        } else {
            const docRef = await addDoc(collection(db, "dossiers_clients"), data);
            currentDocId = docRef.id;
            alert("Nouveau dossier créé !");
        }
        document.getElementById('current-client-name').textContent = (data.nom || "") + " " + (data.prenom || "");
        
    } catch (e) { alert("Erreur sauvegarde : " + e.message); }
    btn.innerHTML = originalText;
};

// Rechercher
window.rechercherDossier = async function() {
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const tbody = document.getElementById('clients-list-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chargement...</td></tr>';
    
    try {
        const q = query(collection(db, "dossiers_clients"), orderBy("lastModified", "desc"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const fullName = `${data.nom || ''} ${data.prenom || ''}`.toLowerCase();
            
            if (fullName.includes(searchVal)) {
                const tr = document.createElement('tr');
                const dateD = data.date_deces ? data.date_deces.split('-').reverse().join('/') : '-';
                
                tr.innerHTML = `
                    <td style="font-weight:bold;">${data.nom || ''} ${data.prenom || ''}</td>
                    <td>${dateD}</td>
                    <td>${data.prestation || '-'}</td>
                    <td style="display:flex; gap:5px;">
                        <button class="btn-outline" style="padding:5px 10px;" onclick="window.chargerDossier('${doc.id}')" title="Ouvrir"><i class="fas fa-folder-open"></i></button>
                        <button class="btn-purple" style="padding:5px 10px; border:none; border-radius:4px; color:white; cursor:pointer;" onclick="window.location.href='facturation.html?id=${doc.id}'" title="Facturer"><i class="fas fa-euro-sign"></i></button>
                        <button class="btn-red" style="padding:5px 10px; border:1px solid #fca5a5; background:#fee2e2; color:#dc2626; border-radius:4px; cursor:pointer;" onclick="window.supprimerClient('${doc.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
        if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucun dossier trouvé.</td></tr>';
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Erreur connexion</td></tr>`; }
};

// Supprimer
window.supprimerClient = async function(id) {
    if(confirm("ATTENTION : Supprimer ce dossier définitivement ?")) {
        try {
            await deleteDoc(doc(db, "dossiers_clients", id));
            window.rechercherDossier();
        } catch (e) { alert("Erreur suppression"); }
    }
};

// Charger
window.chargerDossier = async function(id) {
    try {
        const docRef = doc(db, "dossiers_clients", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentDocId = id;
            for (const [key, value] of Object.entries(data)) {
                const el = document.getElementById(key);
                if (el) {
                    if(el.type === 'checkbox') el.checked = value;
                    else el.value = value;
                } else {
                    const radios = document.getElementsByName(key);
                    if(radios.length > 0) radios.forEach(r => { if(r.value === value) r.checked = true; });
                }
            }
            window.toggleCeremonie();
            window.toggleConjoint();
            window.toggleProf(data.prof_type === 'autre');
            window.toggleVol2();
            document.getElementById('current-client-name').textContent = (data.nom || "") + " " + (data.prenom || "");
            window.openTab('tab-dossier');
        }
    } catch (e) { console.error(e); }
};

window.resetDossier = function() {
    if(confirm("Vider le formulaire ?")) {
        currentDocId = null;
        document.querySelectorAll('input').forEach(i => i.value = '');
        if(document.getElementById('faita')) document.getElementById('faita').value = "Perpignan";
        document.getElementById('current-client-name').textContent = "Nouveau";
        window.openTab('tab-dossier');
    }
};

/* ==========================================================================
   4. UI HELPERS
   ========================================================================== */

window.openTab = function(tabName) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active", "hidden");
    for (let i = 0; i < contents.length; i++) contents[i].classList.add("hidden");
    const tabs = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
    const target = document.getElementById(tabName);
    if(target) { target.classList.remove("hidden"); target.classList.add("active", "fade-in"); }
    
    if(tabName.includes('dossier')) tabs[0]?.classList.add('active');
    else if(tabName.includes('documents')) tabs[1]?.classList.add('active');
    else if(tabName.includes('technique')) tabs[2]?.classList.add('active');
    else if(tabName.includes('base')) tabs[3]?.classList.add('active');

    if(tabName === 'tab-technique') {
        const trans = document.getElementById('section-transport');
        const ferm = document.getElementById('section-fermeture');
        if(trans) trans.classList.add('hidden');
        if(ferm) ferm.classList.add('hidden');
    }
};

window.switchView = function(viewName) {
    const trans = document.getElementById('section-transport');
    const ferm = document.getElementById('section-fermeture');
    if(trans) trans.classList.add('hidden');
    if(ferm) ferm.classList.add('hidden');

    if (viewName === 'transport') {
        if(trans) trans.classList.remove('hidden');
        if(!getVal("faita_transport")) { const el = document.getElementById('faita_transport'); if(el) el.value = getVal("faita"); }
        if(!getVal("dateSignature_transport")) { const el = document.getElementById('dateSignature_transport'); if(el) el.value = getVal("dateSignature"); }
    } else if (viewName === 'fermeture') {
        if(ferm) ferm.classList.remove('hidden');
        if(!getVal("faita_fermeture")) { const el = document.getElementById('faita_fermeture'); if(el) el.value = getVal("faita"); }
        window.togglePresence('famille');
    } else if (viewName === 'main') {
        window.openTab('tab-dossier');
    }
};

window.onload = () => {
    if(document.getElementById('faita')) document.getElementById('faita').value = "Perpignan";
    const today = new Date().toISOString().split('T')[0];
    ['dateSignature', 'date_fermeture', 'date_inhumation', 'date_cremation'].forEach(id => {
        const el = document.getElementById(id);
        if(el && !el.value) el.value = today;
    });
    setTimeout(chargerLogoBase64, 500);
    window.toggleCeremonie();
};

window.toggleCeremonie = function() {
    const el = document.getElementById('prestation');
    if(!el) return;
    const type = el.value;
    
    ['bloc_inhumation', 'bloc_cremation', 'bloc_rapatriement'].forEach(id => {
        const bl = document.getElementById(id); if(bl) bl.classList.add('hidden');
    });
    ['btn_inhumation', 'btn_cremation', 'btn_rapatriement'].forEach(id => {
        const bt = document.getElementById(id); if(bt) bt.classList.add('hidden');
    });

    if (type === "Crémation") {
        document.getElementById('bloc_cremation')?.classList.remove('hidden');
        document.getElementById('btn_cremation')?.classList.remove('hidden');
    } else if (type === "Rapatriement") {
        document.getElementById('bloc_rapatriement')?.classList.remove('hidden');
        document.getElementById('btn_rapatriement')?.classList.remove('hidden');
    } else {
        document.getElementById('bloc_inhumation')?.classList.remove('hidden');
        document.getElementById('btn_inhumation')?.classList.remove('hidden');
    }
};

window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && bloc) {
        if(chk.checked) bloc.classList.remove('hidden'); else bloc.classList.add('hidden');
    }
};

window.toggleProf = function(isAutre) { 
    const el = document.getElementById('profession_autre');
    if(el) { el.disabled = !isAutre; if(!isAutre) el.value = ""; }
};
window.toggleConjoint = function() {
    const sit = document.getElementById("matrimoniale");
    const conj = document.getElementById("conjoint");
    if(sit && conj) { conj.disabled = !["Marié(e)", "Veuf(ve)", "Divorcé(e)"].includes(sit.value); }
};
window.togglePresence = function(type) {
    const fam = document.getElementById('bloc_presence_famille');
    const pol = document.getElementById('bloc_presence_police');
    if(fam && pol) {
        if (type === 'famille') { fam.classList.remove('hidden'); pol.classList.add('hidden'); } 
        else { fam.classList.add('hidden'); pol.classList.remove('hidden'); }
    }
};
window.copierMandant = function() {
    if(getVal("soussigne")) document.getElementById('f_nom_prenom').value = getVal("soussigne");
    if(getVal("lien")) document.getElementById('f_lien').value = getVal("lien");
    if(getVal("demeurant")) document.getElementById('f_adresse').value = getVal("demeurant");
};