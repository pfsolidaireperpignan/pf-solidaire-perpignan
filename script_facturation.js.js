/* ==========================================================================
   FIREBASE & CONFIGURATION (VOTRE COMPTE EST INTEGRÉ ICI)
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- VOTRE CONFIGURATION PRETE A L'EMPLOI ---
const firebaseConfig = {
    apiKey: "AIzaSyDmsIkTjW2IFkIks5BUAnxLLnc7pnj2e0w",
    authDomain: "pf-solidaire.firebaseapp.com",
    projectId: "pf-solidaire",
    storageBucket: "pf-solidaire.firebasestorage.app",
    messagingSenderId: "485465343242",
    appId: "1:485465343242:web:46d2a49f851a95907b26f3",
    measurementId: "G-TWLLXKF0K4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentDocId = null;

/* ==========================================================================
   AUTHENTIFICATION & HUB
   ========================================================================== */
window.loginFirebase = function() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const btn = document.querySelector('.btn-login');
    const errorMsg = document.getElementById('login-error');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification...';

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('hub-accueil').classList.remove('hidden');
        })
        .catch((error) => {
            console.error("Erreur Auth:", error);
            errorMsg.style.display = 'block';
            btn.innerHTML = 'Connexion <i class="fas fa-arrow-right"></i>';
        });
};

window.logout = function() {
    signOut(auth).then(() => {
        window.location.reload();
    }).catch((error) => console.error(error));
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        if(document.getElementById('hub-accueil')) document.getElementById('hub-accueil').classList.remove('hidden');
    }
});

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
};

/* ==========================================================================
   GESTION DOSSIERS (ADMINISTRATIF)
   ========================================================================== */
window.sauvegarderClient = async function() {
    const btn = document.querySelector('.btn-green');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
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
            alert("Nouveau dossier créé ! ID: " + docRef.id);
        }
        document.getElementById('current-client-name').textContent = (data.nom || "") + " " + (data.prenom || "");
    } catch (e) {
        alert("Erreur sauvegarde : " + e.message);
    }
    btn.innerHTML = originalText;
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
                    <td><button class="btn-outline" style="padding:5px 10px;" onclick="window.chargerDossier('${doc.id}')">Ouvrir</button></td>
                `;
                tbody.appendChild(tr);
            }
        });
        if(tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucun dossier trouvé.</td></tr>';
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Erreur</td></tr>`; }
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
            alert("Dossier chargé !");
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

/* ==========================================================================
   FONCTIONS INTERFACE (UI)
   ========================================================================== */
window.openTab = function(tabName) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active", "hidden");
    for (let i = 0; i < contents.length; i++) contents[i].classList.add("hidden");
    
    const tabs = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove("active");
    
    const target = document.getElementById(tabName);
    if(target) {
        target.classList.remove("hidden");
        target.classList.add("active", "fade-in");
    }
    let index = 0;
    if(tabName === 'tab-documents') index = 1;
    if(tabName === 'tab-technique') index = 2;
    if(tabName === 'tab-base') index = 3;
    if(tabs[index]) tabs[index].classList.add("active");

    if(tabName === 'tab-technique') {
        document.getElementById('section-transport').classList.add('hidden');
        document.getElementById('section-fermeture').classList.add('hidden');
    }
};

window.switchView = function(viewName) {
    const trans = document.getElementById('section-transport');
    const ferm = document.getElementById('section-fermeture');
    if(trans) trans.classList.add('hidden');
    if(ferm) ferm.classList.add('hidden');

    if (viewName === 'transport') {
        if(trans) trans.classList.remove('hidden');
        if(!v("faita_transport")) { const el = document.getElementById('faita_transport'); if(el) el.value = v("faita"); }
        if(!v("dateSignature_transport")) { const el = document.getElementById('dateSignature_transport'); if(el) el.value = v("dateSignature"); }
    } else if (viewName === 'fermeture') {
        if(ferm) ferm.classList.remove('hidden');
        if(!v("faita_fermeture")) { const el = document.getElementById('faita_fermeture'); if(el) el.value = v("faita"); }
        window.togglePresence('famille');
    } else if (viewName === 'main') {
        window.openTab('tab-dossier');
    }
};

const v = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
const formatD = (d) => d ? d.split("-").reverse().join("/") : ".................";
let logoBase64 = null;

window.onload = () => {
    if(document.getElementById('faita')) document.getElementById('faita').value = "Perpignan";
    const today = new Date().toISOString().split('T')[0];
    ['dateSignature', 'date_fermeture', 'date_inhumation', 'date_cremation'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = today;
    });
    setTimeout(chargerLogoBase64, 500);
    window.toggleCeremonie();
};

window.toggleCeremonie = function() {
    const el = document.getElementById('prestation');
    if(!el) return;
    const type = el.value;
    const blocInhu = document.getElementById('bloc_inhumation');
    const blocCrema = document.getElementById('bloc_cremation');
    const blocRap = document.getElementById('bloc_rapatriement');
    const btnInhu = document.getElementById('btn_inhumation');
    const btnCrema = document.getElementById('btn_cremation');
    const btnRap = document.getElementById('btn_rapatriement');

    [blocInhu, blocCrema, blocRap].forEach(b => b && b.classList.add('hidden'));
    [btnInhu, btnCrema, btnRap].forEach(b => b && b.classList.add('hidden'));

    if (type === "Crémation") {
        if(blocCrema) { blocCrema.classList.remove('hidden'); blocCrema.classList.add('fade-in'); }
        if(btnCrema) btnCrema.classList.remove('hidden');
    } else if (type === "Rapatriement") {
        if(blocRap) { blocRap.classList.remove('hidden'); blocRap.classList.add('fade-in'); }
        if(btnRap) btnRap.classList.remove('hidden');
    } else {
        if(blocInhu) { blocInhu.classList.remove('hidden'); blocInhu.classList.add('fade-in'); }
        if(btnInhu) btnInhu.classList.remove('hidden');
    }
};

window.toggleVol2 = function() {
    const chk = document.getElementById('check_vol2');
    const bloc = document.getElementById('bloc_vol2');
    if(chk && bloc) {
        if(chk.checked) { bloc.classList.remove('hidden'); bloc.classList.add('fade-in'); } 
        else { bloc.classList.add('hidden'); bloc.classList.remove('fade-in'); }
    }
};

function chargerLogoBase64() {
    const imgElement = document.getElementById('logo-source');
    if (!imgElement || !imgElement.complete || imgElement.naturalWidth === 0) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    ctx.drawImage(imgElement, 0, 0);
    try { logoBase64 = canvas.toDataURL("image/png"); } catch (e) { logoBase64 = null; }
}

function ajouterFiligrane(pdf) {
    if (logoBase64) {
        try {
            pdf.saveGraphicsState();
            pdf.setGState(new pdf.GState({ opacity: 0.06 }));
            const width = 100; const height = 100; 
            pdf.addImage(logoBase64, 'PNG', (210 - width) / 2, (297 - height) / 2, width, height);
            pdf.restoreGraphicsState();
        } catch(e) {}
    }
}

function headerPF(pdf, yPos = 20) {
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(34, 155, 76); pdf.setFontSize(12);
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, yPos, { align: "center" });
    pdf.setTextColor(80); pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
    pdf.text("32 boulevard Léon Jean Grégory Thuir - TEL : 07.55.18.27.77", 105, yPos + 5, { align: "center" });
    pdf.text("HABILITATION N° : 23-66-0205 | SIRET : 53927029800042", 105, yPos + 9, { align: "center" });
    pdf.setDrawColor(34, 155, 76); pdf.setLineWidth(0.5);
    pdf.line(40, yPos + 12, 170, yPos + 12);
}

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
    if(v("soussigne")) document.getElementById('f_nom_prenom').value = v("soussigne");
    if(v("lien")) document.getElementById('f_lien').value = v("lien");
    if(v("demeurant")) document.getElementById('f_adresse').value = v("demeurant");
};

/* --- GENERATION PDF --- */
window.genererPouvoir = function() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    ajouterFiligrane(pdf); headerPF(pdf);
    let typePresta = v("prestation").toUpperCase();
    if(typePresta === "RAPATRIEMENT") typePresta += ` vers ${v("rap_pays").toUpperCase()}`;
    pdf.setFillColor(241, 245, 249); pdf.rect(20, 45, 170, 12, 'F');
    pdf.setFontSize(16); pdf.setTextColor(185, 28, 28); pdf.setFont("helvetica", "bold");
    pdf.text("POUVOIR", 105, 53, { align: "center" });
    pdf.setFontSize(10); pdf.setTextColor(0);
    let y = 75; const x = 25;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Je soussigné(e) : ${v("soussigne")}`, x, y); y+=8;
    pdf.text(`Demeurant à : ${v("demeurant")}`, x, y); y+=8;
    pdf.text(`Agissant en qualité de : ${v("lien")}`, x, y); y+=15;
    pdf.text("Ayant qualité pour pourvoir aux funérailles de :", x, y); y+=8;
    pdf.setDrawColor(200); pdf.setFillColor(250); pdf.rect(x-5, y-5, 170, 40, 'FD');
    pdf.setFont("helvetica", "bold");
    pdf.text(`${v("nom")} ${v("prenom")}`, x, y+2); y+=8;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Né(e) le ${formatD(v("date_naiss"))} à ${v("lieu_naiss")}`, x, y); y+=6;
    pdf.text(`Décédé(e) le ${formatD(v("date_deces"))} à ${v("lieu_deces")}`, x, y); y+=6;
    pdf.text(`Domicile : ${v("adresse_fr")}`, x, y); y+=12;
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(185, 28, 28);
    pdf.text(`POUR : ${typePresta}`, 105, y, {align:"center"}); y+=15;
    pdf.setTextColor(0); pdf.setFont("helvetica", "bold");
    pdf.text("Donne mandat exclusif aux PF SOLIDAIRE PERPIGNAN pour :", x, y); y+=8;
    pdf.setFont("helvetica", "normal");
    pdf.text("- Effectuer toutes les démarches administratives.", x+5, y); y+=6;
    pdf.text("- Signer toute demande d'autorisation nécessaire.", x+5, y); y+=6;
    if(typePresta.includes("RAPATRIEMENT")) {
        pdf.text("- Accomplir les formalités consulaires et douanières.", x+5, y); y+=6;
        pdf.text("- Organiser le transport aérien ou terrestre.", x+5, y); y+=6;
    }
    y = 240;
    pdf.text(`Fait à ${v("faita")}, le ${formatD(v("dateSignature"))}`, x, y);
    pdf.setFont("helvetica", "bold"); pdf.text("Signature du Mandant", 150, y, { align: "center" });
    pdf.save(`Pouvoir_${v("nom")}.pdf`);
};

window.genererDeclaration = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    const fontMain = "times";
    pdf.setFont(fontMain, "bold"); pdf.setFontSize(16);
    pdf.text("DECLARATION DE DECES", 105, 30, { align: "center" });
    pdf.setLineWidth(0.5); pdf.line(75, 31, 135, 31);
    pdf.setFontSize(11);
    pdf.text("Dans tous les cas à remettre obligatoirement complété et signé", 105, 38, { align: "center" });
    pdf.line(55, 39, 155, 39);
    let y = 60; const margin = 20;
    const drawLine = (label, val, yPos) => {
        pdf.setFont(fontMain, "bold"); pdf.text(label, margin, yPos);
        const startDots = margin + pdf.getTextWidth(label) + 2;
        let curX = startDots; pdf.setFont(fontMain, "normal");
        while(curX < 190) { pdf.text(".", curX, yPos); curX += 2; }
        if(val) {
            pdf.setFont(font