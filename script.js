/* ==========================================================================
   GESTION ADMINISTRATIVE (SCRIPT.JS)
   ========================================================================== */
import { db, auth } from './js/config.js';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { chargerLogoBase64, getVal } from './js/utils.js';
import { genererPouvoir, genererDeclaration, genererDemandeInhumation, genererDemandeCremation, genererDemandeRapatriement, genererDemandeFermetureMairie, genererDemandeOuverture, genererFermeture, genererTransport } from './js/pdf_admin.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// ATTACHER LES FONCTIONS AU WINDOW POUR LES BOUTONS HTML
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

// --- AUTH ---
window.loginFirebase = function() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('hub-accueil').classList.remove('hidden');
        })
        .catch((e) => { alert("Erreur connexion: " + e.message); });
};
/* ==========================================================================
   GESTION MOT DE PASSE
   ========================================================================== */

// Ouvrir la fenêtre
window.ouvrirModalMdp = function() {
    document.getElementById('modal-mdp').classList.remove('hidden');
    document.getElementById('new-password').value = ""; // Vider le champ
};

// Fermer la fenêtre
window.fermerModalMdp = function() {
    document.getElementById('modal-mdp').classList.add('hidden');
};

// Valider le changement
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
                alert("Par sécurité, veuillez vous déconnecter et vous reconnecter avant de modifier votre mot de passe.");
                window.logout();
            } else {
                alert("Erreur : " + error.message);
            }
        }
    } else {
        alert("Aucun utilisateur connecté.");
    }
};
window.logout = function() { signOut(auth).then(() => window.location.href = "index.html"); };

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        
        // DETECTION RETOUR DEPUIS FACTURATION
        const urlParams = new URLSearchParams(window.location.search);
        const openId = urlParams.get('open_id');
        if(openId) {
            document.getElementById('hub-accueil').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            window.openTab('tab-dossier');
            setTimeout(() => window.chargerDossier(openId), 500);
        } else {
            if(document.getElementById('hub-accueil')) document.getElementById('hub-accueil').classList.remove('hidden');
        }
    }
});

// --- NAVIGATION ---
window.ouvrirApp = function(type) {
    document.getElementById('hub-accueil').classList.add('hidden');
    if (type === 'admin') {
        document.getElementById('app-content').classList.remove('hidden');
        window.openTab('tab-dossier');
    } else if (type === 'devis') {
        window.location.href = "facturation.html";
    }
};

window.retourHub = function() {
    document.getElementById('app-content').classList.add('hidden');
    document.getElementById('hub-accueil').classList.remove('hidden');
    window.history.pushState({}, document.title, window.location.pathname);
};

// --- CRUD ---
window.sauvegarderClient = async function() {
    const btn = document.querySelector('.btn-green');
    btn.innerHTML = 'Envoi...';
    try {
        const data = {};
        document.querySelectorAll('input, select').forEach(el => {
            if(el.id) {
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
            alert("Dossier créé !");
        }
        document.getElementById('current-client-name').textContent = (data.nom || "") + " " + (data.prenom || "");
    } catch (e) { alert("Erreur : " + e.message); }
    btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

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
                tr.innerHTML = `
                    <td style="font-weight:bold;">${data.nom || ''} ${data.prenom || ''}</td>
                    <td>${data.date_deces || '-'}</td>
                    <td>${data.prestation || '-'}</td>
                    <td style="display:flex; gap:5px;">
                        <button class="btn-outline" style="padding:5px 10px;" onclick="window.chargerDossier('${doc.id}')" title="Modifier Dossier"><i class="fas fa-folder-open"></i></button>
                        <button class="btn-purple" style="padding:5px 10px; border:none; border-radius:4px; color:white; cursor:pointer;" onclick="window.location.href='facturation.html?id=${doc.id}'" title="Créer Facture"><i class="fas fa-euro-sign"></i></button>
                        <button class="btn-red" style="padding:5px 10px; border:1px solid #fca5a5; background:#fee2e2; color:#dc2626; border-radius:4px; cursor:pointer;" onclick="window.supprimerClient('${doc.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
        if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucun dossier trouvé.</td></tr>';
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Erreur connexion</td></tr>`; }
};

window.supprimerClient = async function(id) {
    if(confirm("SUPPRIMER CE DOSSIER CLIENT DÉFINITIVEMENT ?")) {
        try {
            await deleteDoc(doc(db, "dossiers_clients", id));
            window.rechercherDossier();
        } catch(e) { alert("Erreur suppression: " + e.message); }
    }
};

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
        document.getElementById('faita').value = "Perpignan";
        document.getElementById('current-client-name').textContent = "Nouveau";
        window.openTab('tab-dossier');
    }
};

// --- UI HELPERS ---
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