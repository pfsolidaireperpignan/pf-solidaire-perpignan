/* ==========================================================================
   MODULE FACTURATION - LOGIQUE PRO (NON-ECRASEMENT & NUMEROTATION)
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let clientsCache = [];
let currentClientId = null;
let currentInvoiceId = null; 
let originalDocType = null; // Pour savoir si on a changé le type en cours de route

function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.getElementById('facture_date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    initDragAndDrop();

    // Charger Clients
    const datalist = document.getElementById('clients-datalist');
    if(datalist) {
        try {
            const q = query(collection(db, "dossiers_clients"), orderBy("lastModified", "desc"));
            const snaps = await getDocs(q);
            snaps.forEach((doc) => {
                const d = doc.data();
                const nom = `${d.nom || ''} ${d.prenom || ''}`;
                clientsCache.push({ id: doc.id, name: nom, address: d.demeurant || "", defunt: `${d.nom} ${d.prenom}` });
                const opt = document.createElement('option');
                opt.value = nom;
                datalist.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    window.chargerHistorique();
});

// --- CHANGEMENT DE MODÈLE (CONTENU) ---
window.changerModele = function(type) {
    const tbody = document.getElementById('lines-body');
    tbody.innerHTML = ''; 
    document.getElementById('facture_sujet').value = type;

    // SECTION 1
    window.ajouterTitreSection("1 - PRÉPARATION / ORGANISATION DES OBSÈQUES");
    window.ajouterLigne("Chambre funéraire (Séjour)", "NA", 300, "courant");
    window.ajouterLigne("Démarches administratives (Mairie, Préfecture...)", "NA", 250, "courant");
    window.ajouterLigne("Toilette mortuaire : Préparation et habillage", "NA", 150, "courant");
    window.ajouterLigne("Soins de conservation (Thanatopraxie)", "NA", 250, "option");

    // SECTION 2
    window.ajouterTitreSection("2 - TRANSPORT AVANT MISE EN BIÈRE");
    window.ajouterLigne("Véhicule agréé avec chauffeur (Forfait < 50km)", "NA", 450, "courant");

    // SECTION 3
    window.ajouterTitreSection("3 - CERCUEIL ET ACCESSOIRES");
    window.ajouterLigne("Cercueil (Modèle à définir : Pin / Chêne)", "NA", 850, "courant");
    window.ajouterLigne("Plaque d'identité (Obligatoire)", "NA", 30, "courant");
    window.ajouterLigne("Capiton (Taffetas / Satin)", "NA", 80, "courant");
    window.ajouterLigne("4 Poignées + Cuvette (Obligatoire)", "NA", 0, "courant");

    // SECTION 4
    window.ajouterTitreSection("4 - MISE EN BIÈRE ET FERMETURE");
    window.ajouterLigne("Personnel pour mise en bière et fermeture", "NA", 95, "courant");

    // SECTION 5
    window.ajouterTitreSection("5 - CÉRÉMONIE FUNÉRAIRE");
    window.ajouterLigne("Corbillard pour cérémonie avec chauffeur", "NA", 400, "courant");
    window.ajouterLigne("Mise à disposition de porteurs", "NA", 0, "option"); 
    window.ajouterLigne("Registre de condoléances", "NA", 30, "option");

    if (type === "INHUMATION") {
        window.ajouterTitreSection("6 - INHUMATION / EXHUMATION");
        window.ajouterLigne("Ouverture / Fermeture de sépulture", "NA", 685, "courant");
        window.ajouterLigne("Creusement de fosse (Pleine terre)", "NA", 0, "option");
        window.ajouterLigne("Exhumation de corps", "NA", 300, "option");
    } 
    else if (type === "CREMATION") {
        window.ajouterTitreSection("6 - CRÉMATION");
        window.ajouterLigne("Urne cinéraire", "NA", 150, "courant");
        window.ajouterLigne("Redevance Crématorium (Débours)", "NA", 600, "courant");
    }
    else if (type === "RAPATRIEMENT") {
        window.ajouterTitreSection("6 - RAPATRIEMENT");
        window.ajouterLigne("Caisson zinc avec filtre épurateur (Obligatoire)", "NA", 400, "courant");
        window.ajouterLigne("Frais de fret aérien (Estimation Poids)", "NA", 1320, "courant");
        window.ajouterLigne("Ambulance (Aéroport vers lieu d'inhumation)", "NA", 200, "courant");
        window.ajouterLigne("Démarches Consulaires / Douanières", "NA", 150, "courant");
    }
    window.recalculer();
};

// --- DRAG AND DROP ---
function initDragAndDrop() {
    const tbody = document.getElementById('lines-body');
    tbody.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(tbody, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) { tbody.appendChild(draggable); } 
        else { tbody.insertBefore(draggable, afterElement); }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('tr:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } 
        else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function attachDragEvents(row) {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', () => { row.classList.add('dragging'); });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); });
}

// --- CLIENT ---
window.checkClientAuto = function() {
    const val = getVal('facture_nom');
    const found = clientsCache.find(c => c.name === val);
    if (found) {
        document.getElementById('facture_adresse').value = found.address;
        document.getElementById('facture_defunt').value = found.defunt;
        currentClientId = found.id;
        document.getElementById('facture_nom').style.backgroundColor = "#dcfce7";
    } else {
        currentClientId = null;
        document.getElementById('facture_nom').style.backgroundColor = "white";
    }
};

// --- TABLEAU ---
window.ajouterLigne = function(desc = "", tva = "NA", prix = 0, typePrest = "courant") {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "line";
    
    const selectedCourant = typePrest === "courant" ? "selected" : "";
    const selectedOption = typePrest === "option" ? "selected" : "";

    tr.innerHTML = `
        <td style="text-align:center;"><i class="fas fa-grip-vertical drag-handle"></i></td>
        <td style="padding-left:10px;"><input class="l-desc" value="${desc}" placeholder="..."></td>
        <td>
            <select class="l-type-prest" style="font-size:0.8rem; text-align:center;">
                <option value="courant" ${selectedCourant}>Courant</option>
                <option value="option" ${selectedOption}>Optionnel</option>
            </select>
        </td>
        <td style="text-align:center;"><input class="l-tva" value="${tva}" style="text-align:center;"></td>
        <td style="text-align:right;"><input type="number" class="l-prix" value="${prix}" step="0.01" style="text-align:right;" onchange="window.recalculer()"></td>
        <td style="text-align:center;">
            <i class="fas fa-trash" style="color:red; cursor:pointer;" onclick="this.closest('tr').remove(); window.recalculer();"></i>
        </td>
    `;
    attachDragEvents(tr);
    tbody.appendChild(tr);
    window.recalculer();
};

window.ajouterTitreSection = function(titre = "NOUVELLE SECTION") {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "section";
    tr.className = "section-row"; 
    tr.innerHTML = `
        <td style="text-align:center;"><i class="fas fa-grip-vertical drag-handle"></i></td>
        <td colspan="4"><input class="l-desc" value="${titre}" style="font-weight:bold; padding-left:10px; width:100%;"></td>
        <td style="text-align:center;">
            <i class="fas fa-trash" style="color:red; cursor:pointer;" onclick="this.closest('tr').remove(); window.recalculer();"></i>
        </td>
    `;
    attachDragEvents(tr);
    tbody.appendChild(tr);
};

window.recalculer = function() {
    let total = 0;
    document.querySelectorAll('tr[data-type="line"]').forEach(row => {
        const prixInput = row.querySelector('.l-prix');
        if(prixInput) {
            const prix = parseFloat(prixInput.value) || 0;
            total += prix;
        }
    });
    const totalEl = document.getElementById('total-ttc');
    if(totalEl) totalEl.textContent = total.toFixed(2) + ' €';
};

/* ==========================================================================
   SAUVEGARDE & NUMEROTATION LOGIQUE
   ========================================================================== */

// Fonction pour générer D-2026-001 ou F-2026-001
async function getNextNumber(docType) {
    // docType = "DEVIS" ou "FACTURE"
    const prefix = docType === "DEVIS" ? "D" : "F";
    const currentYear = new Date().getFullYear();
    
    try {
        // On cherche le dernier doc de CE type
        const q = query(collection(db, "factures"), where("type", "==", docType), orderBy("created_at", "desc"), limit(1));
        const snaps = await getDocs(q);
        
        let nextSeq = 1;
        
        if (!snaps.empty) {
            const lastDoc = snaps.docs[0].data();
            const lastNum = lastDoc.numero; 
            // Format attendu : X-2026-005
            if (lastNum && lastNum.includes('-')) {
                const parts = lastNum.split('-'); // ["F", "2026", "005"]
                if (parts.length === 3 && parseInt(parts[1]) === currentYear) {
                    nextSeq = parseInt(parts[2]) + 1;
                }
            }
        }
        
        // Formatage sur 3 chiffres (ex: 005)
        const seqStr = nextSeq.toString().padStart(3, '0');
        return `${prefix}-${currentYear}-${seqStr}`;
        
    } catch (e) {
        console.error("Erreur numérotation", e);
        return `${prefix}-${currentYear}-001`; // Secours
    }
}

window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    if(btn) btn.innerHTML = 'Envoi...';
    
    // Vérification Défunt d'abord (car c'est le dossier clé)
    const nomDefunt = getVal('facture_defunt');
    if(!nomDefunt) { if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer'; return alert("Nom du Défunt obligatoire pour créer le dossier."); }

    const selectedType = document.getElementById('doc_type').value; // DEVIS ou FACTURE

    try {
        // 1. GESTION DU DOSSIER (PROSPECT)
        if (!currentClientId) {
            const newClient = {
                nom: nomDefunt.split(' ')[0] || "Défunt",
                prenom: nomDefunt.split(' ').slice(1).join(' ') || "",
                soussigne: getVal('facture_client'), // Le payeur
                demeurant: getVal('facture_adresse'),
                lastModified: new Date().toISOString(),
                type_dossier: "PROSPECT"
            };
            const docRef = await addDoc(collection(db, "dossiers_clients"), newClient);
            currentClientId = docRef.id;
        }

        // 2. DETECTION DU CAS "CONVERSION" (Devis -> Facture)
        // Si on a chargé un document (ID existe) MAIS que le type a changé (Devis -> Facture)
        // ALORS on considère que c'est une NOUVELLE création (on vide l'ID)
        if (currentInvoiceId && originalDocType && originalDocType !== selectedType) {
            currentInvoiceId = null; // On force la création d'un nouveau doc
            console.log("Conversion détectée : Création d'un nouveau document.");
        }

        // 3. NUMEROTATION
        let numFinal = getVal('facture_numero');
        // Si c'est un nouveau doc OU si le numéro est "AUTO"
        if (!currentInvoiceId || numFinal === 'AUTO' || numFinal === '(Auto)') {
            numFinal = await getNextNumber(selectedType);
            document.getElementById('facture_numero').value = numFinal;
        }

        // 4. PREPARATION DONNEES
        const data = {
            type: selectedType,
            numero: numFinal,
            date: getVal('facture_date'),
            sujet: getVal('facture_sujet') || document.getElementById('facture_sujet_select').value, 
            client_id: currentClientId,
            client_nom: getVal('facture_client'), // Mandant
            client_adresse: getVal('facture_adresse'),
            defunt_nom: nomDefunt,
            total: document.getElementById('total-ttc').textContent,
            lignes: [],
            created_at: new Date().toISOString()
        };

        document.querySelectorAll('#lines-body tr').forEach(row => {
            const type = row.dataset.type;
            const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
            const prix = (type === 'line') ? row.querySelector('.l-prix').value : "";
            const tva = (type === 'line') ? row.querySelector('.l-tva').value : "";
            const typePrest = (type === 'line') ? row.querySelector('.l-type-prest').value : "";
            data.lignes.push({ type, desc, prix, tva, typePrest });
        });

        // 5. ENVOI
        if(currentInvoiceId) {
            await updateDoc(doc(db, "factures", currentInvoiceId), data);
            alert("Document mis à jour avec succès !");
        } else {
            await addDoc(collection(db, "factures"), data);
            alert(`Nouveau document créé : ${numFinal}`);
        }
        
        window.chargerHistorique();
        
    } catch (e) { console.error(e); alert("Erreur: " + e.message); }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

// --- HISTORIQUE ---
window.chargerHistorique = async function() {
    const tbody = document.getElementById('history-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Chargement...</td></tr>';
    try {
        const q = query(collection(db, "factures"), orderBy("created_at", "desc"), limit(50));
        const snaps = await getDocs(q);
        historyCache = [];
        snaps.forEach(docSnap => {
            const d = docSnap.data();
            d.id = docSnap.id;
            historyCache.push(d);
        });
        window.renderHistorique(historyCache);
    } catch (e) { console.error(e); }
};

window.renderHistorique = function(items) {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';
    if(items.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucun document.</td></tr>'; return; }

    items.forEach(d => {
        const dateF = new Date(d.created_at).toLocaleDateString();
        // Couleur différente selon Devis ou Facture
        const colorTag = d.type === "FACTURE" ? "background:#dcfce7; color:#166534;" : "background:#e0f2fe; color:#0369a1;";
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateF}</td>
            <td><span class="status-tag" style="${colorTag}">${d.type}</span> <strong>${d.numero}</strong></td>
            <td>
                <div><small>Défunt:</small> <b>${d.defunt_nom}</b></div>
                <div style="font-size:0.8em; color:#666;">Client: ${d.client_nom}</div>
            </td>
            <td>${d.sujet || '-'}</td>
            <td style="font-weight:bold;">${d.total}</td>
            <td style="display:flex; gap:5px;">
                <button onclick="window.chargerFacturePourModif('${d.id}')" title="Modifier" style="cursor:pointer; border:1px solid #cbd5e1; background:white; padding:4px 8px; border-radius:4px;"><i class="fas fa-pen"></i></button>
                <button onclick="window.supprimerFacture('${d.id}')" title="Supprimer" style="cursor:pointer; border:1px solid #fca5a5; background:#fef2f2; padding:4px 8px; border-radius:4px; color:#dc2626;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.supprimerFacture = async function(id) {
    if(confirm("Supprimer définitivement ce document ?")) {
        try {
            await deleteDoc(doc(db, "factures", id));
            window.chargerHistorique();
        } catch(e) { console.error(e); }
    }
};

window.filtrerHistorique = function() {
    const term = document.getElementById('history-search').value.toLowerCase();
    const filtered = historyCache.filter(item => 
        (item.client_nom && item.client_nom.toLowerCase().includes(term)) ||
        (item.defunt_nom && item.defunt_nom.toLowerCase().includes(term)) ||
        (item.numero && item.numero.toLowerCase().includes(term))
    );
    window.renderHistorique(filtered);
};

window.chargerFacturePourModif = async function(id) {
    try {
        const docRef = doc(db, "factures", id);
        const snap = await getDoc(docRef);
        if(!snap.exists()) return alert("Document introuvable");

        const d = snap.data();
        currentInvoiceId = id;
        currentClientId = d.client_id;
        originalDocType = d.type; // On mémorise le type d'origine (DEVIS ou FACTURE)

        document.getElementById('doc_type').value = d.type;
        document.getElementById('facture_numero').value = d.numero;
        document.getElementById('facture_date').value = d.date;
        document.getElementById('facture_client').value = d.client_nom;
        document.getElementById('facture_adresse').value = d.client_adresse || "";
        document.getElementById('facture_defunt').value = d.defunt_nom || "";
        document.getElementById('facture_sujet').value = d.sujet || "";
        
        if(d.sujet && ["INHUMATION", "CREMATION", "RAPATRIEMENT"].includes(d.sujet)) {
            document.getElementById('facture_sujet_select').value = d.sujet;
        } else {
            document.getElementById('facture_sujet_select').value = "AUTRE";
        }

        const tbody = document.getElementById('lines-body');
        tbody.innerHTML = '';
        
        d.lignes.forEach(l => {
            if(l.type === 'section') window.ajouterTitreSection(l.desc);
            else window.ajouterLigne(l.desc, l.tva, l.prix, l.typePrest || "courant");
        });
        window.recalculer();
        window.scrollTo(0,0);
        alert(`Document ${d.numero} chargé.`);
    } catch (e) { console.error(e); }
};

// --- PDF ---
window.genererPDFFacture = function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const type = getVal('doc_type');
    const numero = getVal('facture_numero');

    const imgElement = document.getElementById('logo-source');
    if (imgElement && imgElement.naturalWidth > 0) pdf.addImage(imgElement, 'PNG', 15, 15, 35, 35);
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52); 
    pdf.text("POMPES FUNEBRES", 15, 55);
    pdf.text("SOLIDAIRE PERPIGNAN", 15, 60);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("32 boulevard Léon Jean Grégory Thuir - FRANCE", 15, 66);
    pdf.text("pfsolidaireperpignan@gmail.com", 15, 70);
    pdf.text("SIRET : 539 270 298 00042 - Tél : +33 7 55 18 27 77", 15, 74);

    pdf.setFillColor(240, 240, 240); pdf.rect(120, 20, 75, 40, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("Famille / Client", 125, 28);
    pdf.setFont("helvetica", "normal");
    pdf.text(getVal('facture_client'), 125, 35);
    const adresse = pdf.splitTextToSize(getVal('facture_adresse'), 70);
    pdf.text(adresse, 125, 42);

    let y = 90;
    const sujet = getVal('facture_sujet').toUpperCase() || document.getElementById('facture_sujet_select').value;
    if(sujet && sujet !== "AUTRE") {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(sujet, 15, y);
        y += 10;
    }
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
    let dateFr = getVal('facture_date');
    if(dateFr.includes('-')) dateFr = dateFr.split('-').reverse().join('-');
    pdf.text(`${type} N° ${numero} du ${dateFr}`, 105, y, {align:"center"});
    
    // Afficher le défunt
    y += 8;
    const defunt = getVal('facture_defunt');
    if(defunt) {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(0);
        pdf.text(`Obsèques de : ${defunt}`, 105, y, {align:"center"});
    }
    y += 10;

    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
        if (row.dataset.type === 'section') {
            rows.push([{ content: desc, colSpan: 4, styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'} }]);
        } else {
            const tva = row.querySelector('.l-tva') ? row.querySelector('.l-tva').value : "";
            const prixVal = row.querySelector('.l-prix') ? row.querySelector('.l-prix').value : 0;
            const prixFmt = parseFloat(prixVal).toFixed(2) + ' €';
            const typePrest = row.querySelector('.l-type-prest') ? row.querySelector('.l-type-prest').value : "courant";
            
            let colCourant = "";
            let colOption = "";
            if(typePrest === "courant") colCourant = prixFmt;
            else colOption = prixFmt;

            rows.push([desc, tva, colCourant, colOption]); 
        }
    });

    pdf.autoTable({
        startY: 110,
        head: [['', 'TVA', 'PRIX TTC PRESTATIONS\nCOURANTES', 'PRIX TTC PRESTATIONS\nCOMPLEMENTAIRES\nOPTIONNELLES']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], lineColor: [100, 100, 100], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, valign: 'middle' },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 40, halign: 'right' }, 3: { cellWidth: 40, halign: 'right' } }
    });

    let finalY = pdf.lastAutoTable.finalY + 10;
    pdf.setDrawColor(22, 101, 52); pdf.setLineWidth(0.5);
    pdf.rect(140, finalY, 50, 12);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(0);
    pdf.text("Total (TTC)", 142, finalY + 8);
    pdf.text(document.getElementById('total-ttc').textContent, 188, finalY + 8, {align:'right'});

    finalY += 25;
    pdf.setFontSize(8); pdf.setTextColor(255, 0, 0); 
    pdf.text("NB :", 15, finalY);
    pdf.setTextColor(0);
    pdf.text("- (NA) TVA non applicable (0%), art 293 B du CGI", 25, finalY);
    pdf.text("- Conditions de paiement : 100% soit " + document.getElementById('total-ttc').textContent + " à payer à réception", 25, finalY + 5);

    pdf.save(`${type}_${numero}.pdf`);
};
