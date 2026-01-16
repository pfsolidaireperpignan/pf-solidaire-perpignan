/* ==========================================================================
   FIREBASE & CONFIGURATION
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- VOTRE CONFIGURATION FIREBASE ---
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
                    <td>
                        <button class="btn-outline" style="padding:5px 10px;" onclick="window.chargerDossier('${doc.id}')">
                            <i class="fas fa-folder-open"></i> Ouvrir
                        </button>
                        
                        <button class="btn-purple" style="padding:5px 10px; margin-left:5px; border:none; border-radius:4px; color:white; cursor:pointer;" 
                                onclick="window.location.href='facturation.html?id=${doc.id}'">
                            <i class="fas fa-euro-sign"></i> Facturer
                        </button>
                    </td>
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
            pdf.setFont(fontMain, "bold"); pdf.setFillColor(255, 255, 255);
            pdf.rect(startDots, yPos - 4, pdf.getTextWidth(val)+5, 5, 'F');
            pdf.text(val.toUpperCase(), startDots + 2, yPos);
        }
    };
    drawLine("NOM : ", v("nom"), y); y+=14;
    drawLine("NOM DE JEUNE FILLE : ", v("nom_jeune_fille"), y); y+=14;
    drawLine("Prénoms : ", v("prenom"), y); y+=14;
    drawLine("Né(e) le : ", formatD(v("date_naiss")), y); y+=14;
    drawLine("A : ", v("lieu_naiss"), y); y+=14;
    
    // CORRECTION DATE/LIEU (Fond blanc)
    pdf.setFont(fontMain, "bold"); pdf.text("DATE ET LIEU DU DECES LE", margin, y);
    pdf.setFont(fontMain, "normal"); let dots = margin + 65; while(dots < 115) { pdf.text(".", dots, y); dots+=2; }
    if(v("date_deces")) { 
        pdf.setFont(fontMain, "bold"); pdf.setFillColor(255, 255, 255); 
        pdf.rect(margin+66, y-4, 25, 5, 'F'); 
        pdf.text(formatD(v("date_deces")), margin+67, y); 
    }
    pdf.setFont(fontMain, "bold"); pdf.text("A", 120, y); dots = 125; while(dots < 190) { pdf.text(".", dots, y); dots+=2; }
    if(v("lieu_deces")) { 
        pdf.setFillColor(255, 255, 255); pdf.rect(126, y-4, 60, 5, 'F'); 
        pdf.text(v("lieu_deces").toUpperCase(), 127, y); 
    }
    y += 6; pdf.setFont(fontMain, "bold"); pdf.text("(en son domicile, en clinique, à l'hôpital", margin, y);
    pdf.line(margin, y+1, margin + 75, y+1); pdf.text(")", margin + 75, y); y += 18;
    pdf.text("PROFESSION : ", margin, y); y+=8;
    const prof = document.querySelector('input[name="prof_type"]:checked') ? document.querySelector('input[name="prof_type"]:checked').value : "";
    pdf.rect(margin+5, y-4, 5, 5); if(prof === "Sans profession") pdf.text("X", margin+6, y);
    pdf.setFont(fontMain, "normal"); pdf.text("Sans profession", margin+15, y);
    pdf.rect(margin+60, y-4, 5, 5); if(prof === "Retraité(e)") pdf.text("X", margin+61, y);
    pdf.text("retraité(e)", margin+70, y);
    if(prof === "autre") pdf.text(`Autre : ${v("profession_autre")}`, margin+110, y); y += 15;
    drawLine("DOMICILIE(E) ", v("adresse_fr"), y); y+=14;
    drawLine("FILS OU FILLE de (Père) :", v("pere"), y); y+=14;
    drawLine("Et de (Mère) :", v("mere"), y); y+=14;
    drawLine("Situation Matrimoniale : ", v("matrimoniale"), y); y+=14;
    drawLine("NATIONALITE : ", v("nationalite"), y); y+=25;
    pdf.setFont(fontMain, "bold"); pdf.text("NOM ET SIGNATURE DES POMPES FUNEBRES EN CHARGE DES OBSEQUES", 105, y, { align: "center" });
    y = 280; pdf.setFont(fontMain, "italic"); pdf.setFontSize(10); pdf.text("Aucun acte ne pourra être dressé si le document est incomplet", margin, y);
    pdf.save(`Declaration_Deces_${v("nom")}.pdf`);
};

window.genererDemandeInhumation = function() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    headerPF(pdf);
    pdf.setFillColor(230, 240, 230); pdf.rect(20, 40, 170, 10, 'F');
    pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("DEMANDE D'INHUMATION", 105, 47, { align: "center" });
    let y = 70; const x = 25;
    pdf.setFontSize(11); pdf.text("Monsieur le Maire,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("Je soussigné M. CHERKAOUI Mustapha, dirigeant des PF Solidaire,", x, y); y+=6;
    pdf.text("Sollicite l'autorisation d'inhumer le défunt :", x, y); y+=12;
    pdf.setFont("helvetica", "bold"); pdf.text(`${v("nom").toUpperCase()} ${v("prenom")}`, x+10, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text(`Décédé(e) le ${formatD(v("date_deces"))} à ${v("lieu_deces")}`, x+10, y); y+=15;
    pdf.text("Lieu d'inhumation :", x, y); y+=6;
    pdf.setFont("helvetica", "bold"); pdf.text(`Cimetière : ${v("cimetiere_nom")}`, x+10, y); y+=6;
    pdf.text(`Le : ${formatD(v("date_inhumation"))} à ${v("heure_inhumation")}`, x+10, y); y+=6;
    pdf.text(`Concession : ${v("num_concession")} (${v("type_sepulture")})`, x+10, y); y+=20;
    pdf.setFont("helvetica", "normal"); pdf.text("Veuillez agréer, Monsieur le Maire, mes salutations distinguées.", x, y); y+=20;
    pdf.text(`Fait à ${v("faita")}, le ${formatD(v("dateSignature"))}`, 130, y);
    pdf.save(`Demande_Inhumation_${v("nom")}.pdf`);
};

window.genererDemandeCremation = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    headerPF(pdf);
    pdf.setFont("times", "bold"); pdf.setFontSize(12);
    pdf.text(v("soussigne"), 20, 45); 
    pdf.setFont("times", "normal"); pdf.text(v("demeurant"), 20, 51);
    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("Monsieur le Maire", 150, 60, {align:"center"});
    pdf.setFontSize(12); pdf.text("OBJET : DEMANDE D'AUTORISATION DE CREMATION", 20, 80);
    let y = 100;
    pdf.setFont("times", "normal");
    const txt = `Monsieur le Maire,

Je soussigné(e) ${v("soussigne")}, agissant en qualité de ${v("lien")} du défunt(e), sollicite l'autorisation de procéder à la crémation de :

${v("nom").toUpperCase()} ${v("prenom")}
Né(e) le ${formatD(v("date_naiss"))} et décédé(e) le ${formatD(v("date_deces"))}.

La crémation aura lieu le ${formatD(v("date_cremation"))} au ${v("crematorium_nom")}.
Destination des cendres : ${v("destination_cendres")}.

Je certifie que le défunt n'était pas porteur d'un stimulateur cardiaque.`;
    const splitTxt = pdf.splitTextToSize(txt, 170); pdf.text(splitTxt, 20, y);
    y += (splitTxt.length * 7) + 20;
    pdf.text(`Fait à ${v("faita")}, le ${formatD(v("dateSignature"))}`, 120, y);
    pdf.setFont("times", "bold"); pdf.text("Signature", 120, y+8);
    pdf.save(`Demande_Cremation_${v("nom")}.pdf`);
};

window.genererDemandeRapatriement = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    // PAS DE FILIGRANE NI HEADER PF ICI

    // --- TITRE GÉNÉRALISÉ CENTRÉ ---
    pdf.setDrawColor(0); pdf.setLineWidth(0.5); pdf.setFillColor(240, 240, 240);
    // Cadre centré (largeur page 210, cadre 180, marge gauche 15)
    pdf.rect(15, 20, 180, 20, 'FD');

    pdf.setTextColor(0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text("DEMANDE D'AUTORISATION DE TRANSPORT DE CORPS", 105, 32, {align:"center"});

    let y = 60; const x = 15;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("Je soussigné(e) (nom et prénom) : CHERKAOUI MUSTPAHA", x, y); y+=6;
    pdf.text("Représentant légal de : ", x, y);
    pdf.setFont("helvetica", "normal");
    pdf.text("Pompes Funèbres Solidaire Perpignan, 32 boulevard Léon Jean Grégory Thuir", x+45, y); y+=6;
    pdf.setFont("helvetica", "bold");
    pdf.text("Habilitée sous le n° : 23-66-0205", x, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text("Dûment mandaté par la famille de la défunte, sollicite l'autorisation de faire transporter en dehors du", x, y); y+=5;
    pdf.text("territoire métropolitain le corps après mise en bière de :", x, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Nom et prénom de la défunte : ${v("nom").toUpperCase()} ${v("prenom")}`, x, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date et lieu de naissance    : ${formatD(v("date_naiss"))}       à     ${v("lieu_naiss")}`, x, y); y+=6;
    pdf.text(`Décédé le                         : ${formatD(v("date_deces"))}       à     ${v("lieu_deces")}`, x, y); y+=10;
    pdf.text(`Fille de (père) : ${v("pere")}`, x, y); y+=6;
    pdf.text(`et de (mère) : ${v("mere")}`, x, y); y+=6;
    const conj = v("conjoint") ? v("conjoint") : "";
    pdf.text(`Situation familiale : Époux/se de ${conj}`, x, y); y+=10;
    pdf.setFont("helvetica", "bold"); pdf.setLineWidth(0.5);
    pdf.text("Moyen de transport :", x+5, y); 
    pdf.line(x+5, y+1, x+45, y+1); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x+10, y-3, 3, 3, 'F'); pdf.text("Par voie routière :", x+15, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`- Avec le véhicule funéraire immatriculé : ${v("rap_immat")}`, x+20, y); y+=5;
    pdf.text(`- Date et heure de départ le : ${v("rap_date_dep_route")}`, x+20, y); y+=5;
    pdf.text(`- Lieu de départ : ${v("rap_ville_dep")}`, x+20, y); y+=5;
    pdf.text(`- Commune et pays d'arrivée : ${v("rap_ville_arr")}`, x+20, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x+10, y-3, 3, 3, 'F'); pdf.text("Par voie aérienne :", x+15, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`- Numéro de LTA : ${v("rap_lta")}`, x+20, y); y+=6;
    if(v("vol1_num")) {
        pdf.setFont("helvetica", "bold");
        pdf.text(`- vol : ${v("vol1_num")}`, x+20, y); y+=5;
        pdf.setFont("helvetica", "normal");
        pdf.text(`  > Départ :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport de départ : ${v("vol1_dep_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure de départ le : ${v("vol1_dep_time")}`, x+30, y); y+=5;
        pdf.text(`  > Arrivée :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport d'Arrivée : ${v("vol1_arr_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure d'arrivée le : ${v("vol1_arr_time")}`, x+30, y); y+=8;
    }
    const chk = document.getElementById('check_vol2');
    if(chk && chk.checked && v("vol2_num")) {
        pdf.setFont("helvetica", "bold");
        pdf.text(`- vol : ${v("vol2_num")}`, x+20, y); y+=5;
        pdf.setFont("helvetica", "normal");
        pdf.text(`  > Départ :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport de départ : ${v("vol2_dep_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure de départ le : ${v("vol2_dep_time")}`, x+30, y); y+=5;
        pdf.text(`  > Arrivée :`, x+25, y); y+=5;
        pdf.text(`    - Aéroport d'Arrivée : ${v("vol2_arr_aero")}`, x+30, y); y+=5;
        pdf.text(`    - Date et heure d'arrivée le : ${v("vol2_arr_time")}`, x+30, y); y+=8;
    }
    y+=5;
    pdf.text(`Lieu d'inhumation du corps (Ville – Pays) : ${v("rap_ville")} / ${v("rap_pays")}`, x, y); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Fait à   : ${v("faita")}`, 140, y); y+=6;
    pdf.text(`Le        : ${formatD(v("dateSignature"))}`, 140, y); y+=15;
    pdf.text("Signature et cachet", 140, y);
    pdf.save(`Demande_Rapatriement_Prefecture_${v("nom")}.pdf`);
};

window.genererDemandeFermetureMairie = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    pdf.setDrawColor(26, 90, 143); pdf.setLineWidth(1.5); pdf.rect(10, 10, 190, 277);
    headerPF(pdf);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 90, 143); pdf.setFontSize(16);
    pdf.text("DEMANDE D'AUTORISATION DE FERMETURE", 105, 45, { align: "center" });
    pdf.text("DE CERCUEIL", 105, 53, { align: "center" });
    let y = 80; const x = 25;
    pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("Je soussigné :", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Nom et Prénom : M. CHERKAOUI Mustapha", x+10, y); y+=8;
    pdf.text("• Qualité : Dirigeant PF Solidaire Perpignan", x+10, y); y+=8;
    pdf.text("• Adresse : 32 Bd Léon Jean Grégory, Thuir", x+10, y); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text("A l'honneur de solliciter votre autorisation de fermeture du cercueil de :", x, y); y+=15;
    pdf.setFillColor(245, 245, 245); pdf.rect(x-5, y-5, 170, 35, 'F');
    pdf.text("• Nom et Prénom : " + v("nom").toUpperCase() + " " + v("prenom"), x+10, y); y+=10;
    pdf.text("• Né(e) le : " + formatD(v("date_naiss")) + " à " + v("lieu_naiss"), x+10, y); y+=10;
    pdf.text("• Décédé(e) le : " + formatD(v("date_deces")) + " à " + v("lieu_deces"), x+10, y); y+=20;
    pdf.text("Et ce,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Le : " + formatD(v("date_fermeture")), x+10, y); y+=10;
    pdf.text("• A (Lieu) : " + v("lieu_fermeture"), x+10, y); y+=30;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Fait à ${v("faita")}, le ${formatD(v("dateSignature"))}`, x, y);
    pdf.save(`Demande_Fermeture_${v("nom")}.pdf`);
};

window.genererDemandeOuverture = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    const type = v("prestation");
    headerPF(pdf);
    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("DEMANDE D'OUVERTURE D'UNE SEPULTURE DE FAMILLE", 105, 40, {align:"center"});
    let y = 55; 
    pdf.setFontSize(12);
    pdf.text("POUR", 25, y);
    pdf.rect(45, y-4, 8, 8); 
    if(type === "Inhumation") { pdf.text("X", 47, y+2); }
    pdf.text("INHUMATION", 55, y);
    pdf.rect(95, y-4, 8, 8);
    if(type === "Exhumation") { pdf.text("X", 97, y+2); }
    pdf.text("EXHUMATION", 105, y);
    pdf.rect(145, y-4, 8, 8);
    pdf.text("SCELLEMENT D'URNE", 155, y);
    y += 20; const x = 20;
    pdf.setFont("times", "normal");
    pdf.text("Nous soussignons :", x, y); y+=8;
    pdf.text(`- Nom et Prénom :`, x+10, y); 
    pdf.setFont("times", "bold"); pdf.text(v("soussigne"), x+50, y);
    pdf.setFont("times", "normal"); pdf.text(`Lien de parenté :`, x+110, y);
    pdf.setFont("times", "bold"); pdf.text(v("lien"), x+145, y); y+=15;
    pdf.rect(x-2, y-2, 3, 3, 'F'); pdf.text("Demandons à faire :", x+5, y); y+=8;
    pdf.setFont("times", "bold");
    if(type === "Exhumation") pdf.text("Exhumer le corps dans la concession :", x+5, y);
    else pdf.text("Ouvrir la concession pour inhumation :", x+5, y);
    y+=8;
    pdf.setFont("times", "normal");
    pdf.text(`n° ${v("num_concession")}   acquise par : ${v("titulaire_concession")}`, x+10, y); y+=12;
    pdf.setFont("times", "bold"); pdf.text(`${v("nom")} ${v("prenom")}`, x+30, y);
    pdf.setFont("times", "normal"); pdf.text("né(e) le", x+90, y);
    pdf.setFont("times", "bold"); pdf.text(formatD(v("date_naiss")), x+105, y);
    pdf.setFont("times", "normal"); pdf.text(`à ${v("lieu_naiss")}`, x+135, y); y+=8;
    pdf.text(`Qui demeurait à : ${v("adresse_fr")}`, x+5, y); y+=8;
    pdf.text(`Décédé(e) le : ${formatD(v("date_deces"))} à ${v("lieu_deces")}`, x+5, y); y+=15;
    pdf.rect(x-2, y-2, 3, 3, 'F');
    pdf.setFont("times", "bold"); pdf.text("Mandatons et donnons pouvoir à l'entreprise de pompes funèbres ci-dessus mentionnée", x+5, y); y+=5;
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, y, {align:"center"}); y+=8;
    pdf.setFont("times", "normal");
    pdf.text("D'exécuter les travaux d'ouverture et fermeture ou scellement d'une urne relatifs à l'opération", x, y); y+=5;
    pdf.text("funéraire ci-dessus mentionnée", x, y); y+=8;
    pdf.text(`M : ..........................`, x, y); pdf.setFont("times", "bold"); pdf.text("CHERKAOUI MUSTAPHA", x+40, y); y+=6;
    pdf.setFont("times", "normal");
    pdf.text(`Pompes Funèbres à .........`, x, y); pdf.setFont("times", "bold"); pdf.text("32 boulevard Léon Jean Grégory Thuir", x+45, y); y+=15;
    pdf.setFont("times", "bold");
    pdf.text("Date et heure de l'inhumation au cimetière de l'exhumation du scellement", x, y); y+=10;
    pdf.text("..........................................................................................................................................", x, y); y+=15;
    pdf.setFontSize(10); pdf.setFont("times", "normal");
    const txt = "La présente déclaration dont j'assure la peine et entière responsabilité m'engage à garantir la ville contre toute réclamation qui pourrait survenir suite à l'inhumation l'exhumation ou le scellement d'urne qui en fait objet.\n\nEnfin conférèrent à la réglementation en vigueur je m'engage à fournir la preuve de la qualité du ou des ayants droits (livret de famille, acte de naissance, attestation notariée etc.) et déposer ou service Réglementation funéraire de la ville, la copie du ou des document(s) précité prouvant la qualité du ou des ayants droits";
    const splitTxt = pdf.splitTextToSize(txt, 170);
    pdf.text(splitTxt, x, y);
    y += 40;
    pdf.setFont("times", "bold"); pdf.setFontSize(12);
    pdf.text("Signature des déclarants", 140, y);
    pdf.save(`Ouverture_Sepulture_${v("nom")}.pdf`);
}

window.genererFermeture = function() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    ajouterFiligrane(pdf);
    headerPF(pdf);
    pdf.setFillColor(52, 73, 94); pdf.rect(0, 35, 210, 15, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(255, 255, 255);
    pdf.text("PROCÈS-VERBAL DE FERMETURE DE CERCUEIL", 105, 45, { align: "center" });
    pdf.setTextColor(0); pdf.setFontSize(10);
    let y = 65; const x = 20;
    pdf.setDrawColor(200); pdf.setLineWidth(0.5); pdf.rect(x, y, 170, 20);
    pdf.setFont("helvetica", "bold"); pdf.text("L'OPÉRATEUR FUNÉRAIRE", x+5, y+5);
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon Jean Grégory, Thuir", x+5, y+10);
    pdf.text("Habilitation : 23-66-0205", x+5, y+15); y += 30;
    pdf.text("Nous, soussignés, certifions avoir procédé à la fermeture et au scellement du cercueil.", x, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text(`DATE : ${formatD(v("date_fermeture"))}`, x, y);
    pdf.text(`LIEU : ${v("lieu_fermeture")}`, x+80, y); y+=15;
    pdf.setFillColor(240, 240, 240); pdf.rect(x, y, 170, 30, 'F');
    pdf.setFont("helvetica", "bold"); pdf.text("IDENTITÉ DU DÉFUNT(E)", x+5, y+6);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Nom : ${v("nom").toUpperCase()}`, x+5, y+14); pdf.text(`Prénom : ${v("prenom")}`, x+80, y+14);
    pdf.text(`Né(e) le : ${formatD(v("date_naiss"))}`, x+5, y+22); pdf.text(`Décédé(e) le : ${formatD(v("date_deces"))}`, x+80, y+22); y+=40;
    const isPolice = document.querySelector('input[name="type_presence"][value="police"]').checked;
    pdf.setFont("helvetica", "bold"); pdf.text("EN PRÉSENCE DE :", x, y); y+=10;
    pdf.rect(x, y, 170, 30);
    if(isPolice) {
        pdf.text("AUTORITÉ DE POLICE (Absence de famille)", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom & Grade : ${v("p_nom_grade")}`, x+5, y+14);
        pdf.text(`Commissariat : ${v("p_commissariat")}`, x+5, y+22);
    } else {
        pdf.text("LA FAMILLE", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom : ${v("f_nom_prenom")}`, x+5, y+14);
        pdf.text(`Lien de parenté : ${v("f_lien")}`, x+80, y+14);
        pdf.text(`Domicile : ${v("f_adresse")}`, x+5, y+22);
    }
    y+=45;
    pdf.line(20, y, 190, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature Opérateur", 40, y);
    pdf.text(isPolice ? "Signature Police" : "Signature Famille", 140, y);
    pdf.save(`PV_Fermeture_${v("nom")}.pdf`);
}

window.genererTransport = function() {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    pdf.setLineWidth(1); pdf.rect(10, 10, 190, 277);
    headerPF(pdf);
    pdf.setFillColor(200); pdf.rect(10, 35, 190, 15, 'F');
    const typeT = document.querySelector('input[name="transport_type"]:checked').value;
    const labelT = typeT === "avant" ? "AVANT MISE EN BIÈRE" : "APRÈS MISE EN BIÈRE";
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text(`DÉCLARATION DE TRANSPORT DE CORPS`, 105, 42, { align: "center" });
    pdf.setFontSize(12); pdf.text(labelT, 105, 47, { align: "center" });
    let y = 70; const x = 20;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("TRANSPORTEUR :", x, y); y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon J. Grégory, Thuir", x, y); y+=15;
    pdf.setDrawColor(0); pdf.rect(x, y, 170, 25);
    pdf.setFont("helvetica", "bold"); pdf.text("DÉFUNT(E)", x+5, y+6);
    pdf.setFontSize(14); pdf.text(`${v("nom")} ${v("prenom")}`, 105, y+15, {align:"center"});
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text(`Né(e) le ${formatD(v("date_naiss"))}`, 105, y+21, {align:"center"}); y+=35;
    pdf.setLineWidth(0.5); pdf.rect(x, y, 80, 50); pdf.rect(x+90, y, 80, 50);
    pdf.setFont("helvetica", "bold"); pdf.text("LIEU DE DÉPART", x+5, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(v("lieu_depart_t"), x+5, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+5, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatD(v("date_depart_t"))} à ${v("heure_depart_t")}`, x+5, y+42);
    pdf.setFont("helvetica", "bold"); pdf.text("LIEU D'ARRIVÉE", x+95, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(v("lieu_arrivee_t"), x+95, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+95, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatD(v("date_arrivee_t"))} à ${v("heure_arrivee_t")}`, x+95, y+42); y+=60;
    pdf.setFillColor(230); pdf.rect(x, y, 170, 10, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.text(`VÉHICULE AGRÉÉ IMMATRICULÉ : ${v("immatriculation")}`, 105, y+7, {align:"center"}); y+=30;
    pdf.text(`Fait à ${v("faita_transport")}, le ${formatD(v("dateSignature_transport"))}`, 120, y);
    pdf.text("Cachet de l'entreprise :", 120, y+10);
    pdf.save(`Transport_${v("nom")}.pdf`);
}
