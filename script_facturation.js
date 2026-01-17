/* ==========================================================================
   MODULE FACTURATION - LOGIQUE COMPLÈTE (VUES + METIER)
   ========================================================================== */
import { db } from './js/config.js';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal } from './js/utils.js';
import { genererPDFFacture } from './js/pdf_invoice.js';

// ATTACHER LES FONCTIONS IMPORTÉES ET LOCALES AU WINDOW (Pour les onclick HTML)
window.genererPDFFacture = genererPDFFacture;

// Variables Globales
let clientsCache = [];
let historyCache = [];
let currentClientId = null;
let currentInvoiceId = null;
let originalDocType = null;

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialiser le Drag & Drop
    initDragAndDrop();

    // 2. Initialiser la date du jour
    const dateInput = document.getElementById('facture_date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // 3. Charger les Clients (Pour la recherche dans le formulaire)
    const datalist = document.getElementById('clients-datalist');
    if(datalist) {
        try {
            const q = query(collection(db, "dossiers_clients"), orderBy("lastModified", "desc"));
            const snaps = await getDocs(q);
            snaps.forEach((doc) => {
                const d = doc.data();
                // Format : NOM Prenom (Défunt: Nom)
                const label = `${d.soussigne || d.nom} (Défunt: ${d.nom})`;
                
                clientsCache.push({ 
                    id: doc.id, 
                    label: label, 
                    nom_mandant: d.soussigne || d.nom,
                    nom_defunt: `${d.nom} ${d.prenom}`,
                    adresse: d.demeurant || "" 
                });
                
                const opt = document.createElement('option');
                opt.value = label;
                datalist.appendChild(opt);
            });
        } catch (e) { console.error("Erreur chargement clients:", e); }
    }

    // 4. CHECK URL ID (Redirection depuis l'Admin vers Facturation)
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    
    if(idFromUrl) {
        // Si on vient de l'admin, on ouvre direct le formulaire en mode création
        window.nouvelleFacture();
        // On attend un peu que le cache soit prêt ou on charge directement
        setTimeout(() => window.chargerDossierParID(idFromUrl), 500);
    } else {
        // Sinon, on affiche la liste par défaut
        window.afficherListe();
    }
});

/* ==========================================================================
   1. GESTION DES VUES (LISTE vs FORMULAIRE)
   ========================================================================== */

window.afficherListe = function() {
    document.getElementById('view-form').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    window.chargerHistorique(); // Rafraichir la liste
    // Nettoyer l'URL
    window.history.pushState({}, document.title, window.location.pathname);
};

window.afficherFormulaire = function() {
    document.getElementById('view-list').classList.add('hidden');
    document.getElementById('view-form').classList.remove('hidden');
    window.scrollTo(0,0);
};

window.nouvelleFacture = function() {
    // Reset complet des variables
    currentInvoiceId = null;
    currentClientId = null;
    originalDocType = null;
    
    // Reset des champs
    document.getElementById('facture_numero').value = "(Auto)";
    document.getElementById('facture_date').value = new Date().toISOString().split('T')[0];
    document.getElementById('facture_nom').value = "";
    document.getElementById('facture_adresse').value = "";
    document.getElementById('facture_defunt').value = "";
    document.getElementById('doc_type').value = "DEVIS";
    document.getElementById('facture_sujet_select').value = "";
    document.getElementById('lines-body').innerHTML = "";
    document.getElementById('total-ttc').textContent = "0.00 €";
    
    window.afficherFormulaire();
};

window.annulerModifications = function() {
    if(confirm("Annuler la saisie en cours et revenir à la liste ?")) {
        window.afficherListe();
    }
};

/* ==========================================================================
   2. HISTORIQUE & CHARGEMENT
   ========================================================================== */

// Charger l'historique dans le tableau (Vue Liste)
window.chargerHistorique = async function() {
    const tbody = document.getElementById('history-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Chargement...</td></tr>';

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

// Afficher les lignes du tableau
window.renderHistorique = function(items) {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';
    
    if(items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Aucun document trouvé.</td></tr>';
        return;
    }

    items.forEach(d => {
        const dateF = new Date(d.created_at).toLocaleDateString();
        const tagClass = d.type === "FACTURE" ? "tag-facture" : "tag-devis";
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateF}</td>
            <td><span class="status-tag ${tagClass}">${d.type}</span></td>
            <td><strong>${d.numero}</strong></td>
            <td>
                <div style="font-weight:bold;">${d.client_nom}</div>
                <div style="font-size:0.85em; color:#666;">Obsèques: ${d.defunt_nom}</div>
            </td>
            <td>${d.sujet || '-'}</td>
            <td style="text-align:right; font-weight:bold;">${d.total}</td>
            <td style="text-align:center;">
                <button onclick="window.chargerFacturePourModif('${d.id}')" title="Modifier" style="cursor:pointer; border:1px solid #cbd5e1; background:white; padding:5px 10px; border-radius:4px; margin-right:5px;">
                    <i class="fas fa-pen" style="color:#334155;"></i>
                </button>
                
                <button onclick="window.ouvrirDossierAssocie('${d.client_id}')" title="Dossier Admin" style="cursor:pointer; border:1px solid #93c5fd; background:#eff6ff; padding:5px 10px; border-radius:4px; margin-right:5px;">
                    <i class="fas fa-folder-open" style="color:#1e40af;"></i>
                </button>

                <button onclick="window.supprimerFacture('${d.id}')" title="Supprimer" style="cursor:pointer; border:1px solid #fca5a5; background:#fef2f2; padding:5px 10px; border-radius:4px;">
                    <i class="fas fa-trash" style="color:#dc2626;"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.filtrerHistorique = function() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const filtered = historyCache.filter(item => 
        (item.client_nom && item.client_nom.toLowerCase().includes(term)) ||
        (item.defunt_nom && item.defunt_nom.toLowerCase().includes(term)) ||
        (item.numero && item.numero.toLowerCase().includes(term))
    );
    window.renderHistorique(filtered);
};

window.supprimerFacture = async function(id) {
    if(confirm("Supprimer définitivement ce document ?")) {
        try {
            await deleteDoc(doc(db, "factures", id));
            window.chargerHistorique();
        } catch(e) { console.error(e); alert("Erreur suppression"); }
    }
};

window.ouvrirDossierAssocie = function(clientId) {
    if(clientId) {
        // Redirige vers le Hub Admin en demandant d'ouvrir ce dossier
        window.location.href = "index.html?open_id=" + clientId;
    } else {
        alert("Aucun dossier client lié à ce document.");
    }
};

/* ==========================================================================
   3. LOGIQUE FORMULAIRE (AUTO-COMPLETION, MODELES, CALCULS)
   ========================================================================== */

// Auto-complétion via le champ recherche du formulaire
window.checkClientAuto = function() {
    const val = getVal('facture_nom');
    const found = clientsCache.find(c => c.label === val);
    
    if (found) {
        document.getElementById('facture_adresse').value = found.adresse;
        document.getElementById('facture_defunt').value = found.nom_defunt;
        // On n'affiche que le nom du mandant dans le champ client pour que ce soit propre sur le PDF
        document.getElementById('facture_nom').value = found.nom_mandant; 
        currentClientId = found.id;
    }
};

// Chargement d'un client par ID (depuis l'admin)
window.chargerDossierParID = async function(id) {
    try {
        let found = clientsCache.find(c => c.id === id);
        
        // Si pas dans le cache, on va le chercher
        if (!found) {
            const docRef = doc(db, "dossiers_clients", id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const d = snap.data();
                found = {
                    id: snap.id,
                    nom_mandant: d.soussigne || d.nom,
                    nom_defunt: `${d.nom} ${d.prenom}`,
                    adresse: d.demeurant || ""
                };
            }
        }

        if (found) {
            document.getElementById('facture_nom').value = found.nom_mandant;
            document.getElementById('facture_adresse').value = found.adresse;
            document.getElementById('facture_defunt').value = found.nom_defunt;
            currentClientId = found.id;
        }
    } catch (e) { console.error(e); }
};

// Chargement d'une facture existante pour modification
window.chargerFacturePourModif = async function(id) {
    try {
        const docRef = doc(db, "factures", id);
        const snap = await getDoc(docRef);
        if(!snap.exists()) return alert("Document introuvable");

        const d = snap.data();
        currentInvoiceId = id;
        currentClientId = d.client_id;
        originalDocType = d.type;

        // Remplissage Champs
        document.getElementById('doc_type').value = d.type;
        document.getElementById('facture_numero').value = d.numero;
        document.getElementById('facture_date').value = d.date;
        document.getElementById('facture_nom').value = d.client_nom;
        document.getElementById('facture_adresse').value = d.client_adresse || "";
        document.getElementById('facture_defunt').value = d.defunt_nom || "";
        
        // Sujet
        const select = document.getElementById('facture_sujet_select');
        if(["INHUMATION", "CREMATION", "RAPATRIEMENT"].includes(d.sujet)) {
            select.value = d.sujet;
        } else {
            select.value = "AUTRE";
        }
        document.getElementById('facture_sujet').value = d.sujet || "";

        // Remplissage Tableau
        const tbody = document.getElementById('lines-body');
        tbody.innerHTML = '';
        d.lignes.forEach(l => {
            if(l.type === 'section') window.ajouterTitreSection(l.desc);
            else window.ajouterLigne(l.desc, l.tva, l.prix, l.typePrest || "courant");
        });

        window.recalculer();
        window.afficherFormulaire(); // Bascule vers la vue formulaire

    } catch (e) { console.error(e); }
};

// Chargement des modèles pré-remplis
window.changerModele = function(type) {
    const tbody = document.getElementById('lines-body');
    tbody.innerHTML = ''; // Reset
    document.getElementById('facture_sujet').value = type;

    // SECTION 1
    window.ajouterTitreSection("1 - PRÉPARATION / ORGANISATION DES OBSÈQUES");
    window.ajouterLigne("Chambre funéraire (Séjour)", "NA", 300, "courant");
    window.ajouterLigne("Démarches administratives", "NA", 250, "courant");
    window.ajouterLigne("Toilette mortuaire", "NA", 150, "courant");
    window.ajouterLigne("Soins de conservation (Thanatopraxie)", "NA", 250, "option");

    // SECTION 2
    window.ajouterTitreSection("2 - TRANSPORT AVANT MISE EN BIÈRE");
    window.ajouterLigne("Véhicule agréé avec chauffeur", "NA", 450, "courant");

    // SECTION 3
    window.ajouterTitreSection("3 - CERCUEIL ET ACCESSOIRES");
    window.ajouterLigne("Cercueil (Modèle à définir)", "NA", 850, "courant");
    window.ajouterLigne("Plaque d'identité", "NA", 30, "courant");
    window.ajouterLigne("Capiton", "NA", 80, "courant");
    window.ajouterLigne("4 Poignées + Cuvette", "NA", 0, "courant");

    // SECTION 4
    window.ajouterTitreSection("4 - MISE EN BIÈRE ET FERMETURE");
    window.ajouterLigne("Personnel pour mise en bière", "NA", 95, "courant");

    // SECTION 5
    window.ajouterTitreSection("5 - CÉRÉMONIE FUNÉRAIRE");
    window.ajouterLigne("Corbillard pour cérémonie avec chauffeur", "NA", 400, "courant");
    window.ajouterLigne("Mise à disposition de porteurs", "NA", 0, "option"); 
    window.ajouterLigne("Registre de condoléances", "NA", 30, "option");

    // SECTIONS SPECIFIQUES
    if (type === "INHUMATION") {
        window.ajouterTitreSection("6 - INHUMATION / EXHUMATION");
        window.ajouterLigne("Ouverture / Fermeture sépulture", "NA", 685, "courant");
        window.ajouterLigne("Creusement fosse", "NA", 0, "option");
        window.ajouterLigne("Exhumation", "NA", 300, "option");
    } 
    else if (type === "CREMATION") {
        window.ajouterTitreSection("6 - CRÉMATION");
        window.ajouterLigne("Urne cinéraire", "NA", 150, "courant");
        window.ajouterLigne("Redevance Crématorium", "NA", 600, "courant");
    }
    else if (type === "RAPATRIEMENT") {
        window.ajouterTitreSection("6 - RAPATRIEMENT");
        window.ajouterLigne("Caisson zinc avec filtre", "NA", 400, "courant");
        window.ajouterLigne("Frais fret aérien", "NA", 1320, "courant");
        window.ajouterLigne("Ambulance vers inhumation", "NA", 200, "courant");
        window.ajouterLigne("Démarches Consulaires", "NA", 150, "courant");
    }
    
    window.recalculer();
};

/* ==========================================================================
   4. GESTION DU TABLEAU (LIGNES, CALCULS, DRAG & DROP)
   ========================================================================== */

window.ajouterLigne = function(desc = "", tva = "NA", prix = 0, typePrest = "courant") {
    const tbody = document.getElementById('lines-body');
    const tr = document.createElement('tr');
    tr.dataset.type = "line";
    
    const selC = typePrest === "courant" ? "selected" : "";
    const selO = typePrest === "option" ? "selected" : "";

    tr.innerHTML = `
        <td style="text-align:center;"><i class="fas fa-grip-vertical drag-handle"></i></td>
        <td style="padding-left:10px;"><input class="l-desc" value="${desc}" placeholder="..."></td>
        <td>
            <select class="l-type-prest" style="font-size:0.8rem; text-align:center;">
                <option value="courant" ${selC}>Courant</option>
                <option value="option" ${selO}>Optionnel</option>
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
    document.getElementById('total-ttc').textContent = total.toFixed(2) + ' €';
};

// --- DRAG & DROP LOGIQUE ---
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

/* ==========================================================================
   5. SAUVEGARDE ET NUMÉROTATION
   ========================================================================== */

// Générateur de numéro (F-2026-001 ou D-2026-001)
async function getNextNumber(docType) {
    const prefix = docType === "DEVIS" ? "D" : "F";
    const currentYear = new Date().getFullYear();
    try {
        // On cherche le dernier doc de ce type pour l'année en cours
        const q = query(collection(db, "factures"), where("type", "==", docType), orderBy("created_at", "desc"), limit(1));
        const snaps = await getDocs(q);
        
        let nextSeq = 1;
        if (!snaps.empty) {
            const lastDoc = snaps.docs[0].data();
            const lastNum = lastDoc.numero; 
            if (lastNum && lastNum.includes('-')) {
                const parts = lastNum.split('-'); // ex: ["F", "2026", "005"]
                if (parts.length === 3 && parseInt(parts[1]) === currentYear) {
                    nextSeq = parseInt(parts[2]) + 1;
                }
            }
        }
        return `${prefix}-${currentYear}-${nextSeq.toString().padStart(3, '0')}`;
    } catch (e) { return `${prefix}-${currentYear}-001`; }
}

window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    if(btn) btn.innerHTML = 'Envoi...';
    
    const nomClient = getVal('facture_nom');
    const nomDefunt = getVal('facture_defunt');
    const selectedType = document.getElementById('doc_type').value;

    if(!nomClient) { if(btn) btn.innerHTML = 'Enregistrer'; return alert("Nom du Client obligatoire"); }

    try {
        // 1. Création Dossier Client si nouveau
        if (!currentClientId) {
            const newClient = {
                nom: nomDefunt.split(' ')[0] || "Défunt",
                prenom: nomDefunt.split(' ').slice(1).join(' ') || "",
                soussigne: nomClient,
                demeurant: getVal('facture_adresse'),
                lastModified: new Date().toISOString(),
                type_dossier: "PROSPECT"
            };
            const docRef = await addDoc(collection(db, "dossiers_clients"), newClient);
            currentClientId = docRef.id;
        }

        // 2. Logique Conversion Devis -> Facture (Création Nouveau Doc)
        let mode = "UPDATE";
        
        // Si on édite un DEVIS mais qu'on sauvegarde en FACTURE -> Nouveau doc
        if (currentInvoiceId && originalDocType === "DEVIS" && selectedType === "FACTURE") {
            mode = "CREATE"; 
            currentInvoiceId = null; // On oublie l'ID pour forcer la création
            document.getElementById('facture_numero').value = "(Auto)";
            alert("CONVERSION : Une nouvelle FACTURE sera créée (Le devis reste intact).");
        } 
        else if (!currentInvoiceId) {
            mode = "CREATE";
        }

        // 3. Attribution Numéro
        let numFinal = getVal('facture_numero');
        if (mode === "CREATE" || numFinal === '(Auto)' || numFinal === 'AUTO') {
            numFinal = await getNextNumber(selectedType);
            document.getElementById('facture_numero').value = numFinal;
        }

        const data = {
            type: selectedType,
            numero: numFinal,
            date: getVal('facture_date'),
            sujet: getVal('facture_sujet') || document.getElementById('facture_sujet_select').value, 
            client_id: currentClientId,
            client_nom: nomClient,
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

        if (mode === "UPDATE" && currentInvoiceId) {
            await updateDoc(doc(db, "factures", currentInvoiceId), data);
            alert("Document mis à jour !");
        } else {
            const newDoc = await addDoc(collection(db, "factures"), data);
            currentInvoiceId = newDoc.id; // On reste sur le nouveau doc
            originalDocType = selectedType;
            alert(`Document créé : ${numFinal}`);
        }
        
    } catch (e) { console.error(e); alert("Erreur: " + e.message); }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

// Fonctions globales attachées à window (pour que les onclick fonctionnent avec les modules)
window.ajouterLigne = ajouterLigne;
window.ajouterTitreSection = ajouterTitreSection;
window.recalculer = recalculer;
window.sauvegarderFactureBase = sauvegarderFactureBase;
window.chargerFacturePourModif = chargerFacturePourModif;
window.supprimerFacture = supprimerFacture;
window.checkClientAuto = checkClientAuto;
window.annulerModifications = annulerModifications;
window.changerModele = changerModele;
window.genererPDFFacture = genererPDFFacture;