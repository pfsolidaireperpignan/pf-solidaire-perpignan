/* ==========================================================================
   MODULE FACTURATION - DRAG & DROP + SUPPRESSION
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let historyCache = [];
let currentClientId = null;
let currentInvoiceId = null;

// --- SECURITE ---
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }

// --- INIT ---
window.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.getElementById('facture_date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Drag & Drop Init
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

    // Charger Historique
    window.chargerHistorique();

    // Lignes défaut
    window.ajouterTitreSection("1. PRESTATIONS");
    window.ajouterLigne("Cercueil", "NA", 0);
});

// --- DRAG AND DROP (LOGIQUE) ---
function initDragAndDrop() {
    const tbody = document.getElementById('lines-body');
    
    tbody.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(tbody, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            tbody.appendChild(draggable);
        } else {
            tbody.insertBefore(draggable, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('tr:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function attachDragEvents(row) {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', () => { row.classList.add('dragging'); });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); });
}

// --- AUTO-COMPLETE CLIENT ---
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

/* ==========================================================================
   GESTION TABLEAU
   ========================================================================== */

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
    
    attachDragEvents(tr); // Activer le drag
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
    attachDragEvents(tr); // Activer le drag
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
   SAUVEGARDE
   ========================================================================== */

async function getNextInvoiceNumber() {
    try {
        const q = query(collection(db, "factures"), orderBy("created_at", "desc"), limit(1));
        const snaps = await getDocs(q);
        let lastNum = 0;
        if (!snaps.empty) {
            const lastDoc = snaps.docs[0].data();
            if (lastDoc.numero && lastDoc.numero.includes('-')) {
                const parts = lastDoc.numero.split('-');
                if(parts.length > 1) lastNum = parseInt(parts[1]);
            }
        }
        const year = new Date().getFullYear();
        const next = lastNum + 1;
        return `${year}-${next.toString().padStart(3, '0')}`;
    } catch (e) {
        console.error("Erreur numérotation", e);
        return "2026-001"; 
    }
}

window.sauvegarderFactureBase = async function() {
    const btn = document.querySelector('.btn-green');
    if(btn) btn.innerHTML = 'Envoi...';
    
    const nom = getVal('facture_nom');
    if(!nom) { if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer'; return alert("Nom du client obligatoire"); }

    try {
        if (!currentClientId) {
            const newClient = {
                nom: nom,
                demeurant: getVal('facture_adresse'),
                lastModified: new Date().toISOString(),
                type_dossier: "PROSPECT"
            };
            const docRef = await addDoc(collection(db, "dossiers_clients"), newClient);
            currentClientId = docRef.id;
        }

        let numFinal = getVal('facture_numero');
        if (!currentInvoiceId && (numFinal === 'AUTO' || numFinal === '(Auto)' || numFinal === '')) {
            numFinal = await getNextInvoiceNumber();
            document.getElementById('facture_numero').value = numFinal;
        }

        const data = {
            type: getVal('doc_type'),
            numero: numFinal,
            date: getVal('facture_date'),
            sujet: getVal('facture_sujet'),
            client_id: currentClientId,
            client_nom: nom,
            client_adresse: getVal('facture_adresse'),
            defunt_nom: getVal('facture_defunt'),
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

        if(currentInvoiceId) {
            await updateDoc(doc(db, "factures", currentInvoiceId), data);
            alert("Document mis à jour !");
        } else {
            await addDoc(collection(db, "factures"), data);
            alert("Document créé avec le N° " + numFinal);
        }
        
        window.chargerHistorique();
        
    } catch (e) { console.error(e); alert("Erreur: " + e.message); }
    if(btn) btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
};

/* ==========================================================================
   HISTORIQUE & SUPPRESSION
   ========================================================================== */

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
    
    if(items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucun document trouvé.</td></tr>';
        return;
    }

    items.forEach(d => {
        const dateF = new Date(d.created_at).toLocaleDateString();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateF}</td>
            <td><span class="status-tag">${d.type}</span> <strong>${d.numero}</strong></td>
            <td>${d.client_nom}</td>
            <td>${d.sujet || '-'}</td>
            <td style="font-weight:bold;">${d.total}</td>
            <td style="display:flex; gap:5px;">
                <button onclick="window.chargerFacturePourModif('${d.id}')" title="Modifier" style="cursor:pointer; border:1px solid #cbd5e1; background:white; padding:4px 8px; border-radius:4px; color:#334155;">
                    <i class="fas fa-pen"></i>
                </button>
                <button onclick="window.supprimerFacture('${d.id}')" title="Supprimer" style="cursor:pointer; border:1px solid #fca5a5; background:#fef2f2; padding:4px 8px; border-radius:4px; color:#dc2626;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.supprimerFacture = async function(id) {
    if(confirm("Êtes-vous sûr de vouloir supprimer définitivement ce document ?")) {
        try {
            await deleteDoc(doc(db, "factures", id));
            alert("Document supprimé.");
            window.chargerHistorique(); // Rafraichissement immédiat
        } catch(e) {
            console.error(e);
            alert("Erreur lors de la suppression.");
        }
    }
};

window.filtrerHistorique = function() {
    const term = document.getElementById('history-search').value.toLowerCase();
    const filtered = historyCache.filter(item => 
        (item.client_nom && item.client_nom.toLowerCase().includes(term)) ||
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

        document.getElementById('doc_type').value = d.type;
        document.getElementById('facture_numero').value = d.numero;
        document.getElementById('facture_date').value = d.date;
        document.getElementById('facture_nom').value = d.client_nom;
        document.getElementById('facture_adresse').value = d.client_adresse || "";
        document.getElementById('facture_defunt').value = d.defunt_nom || "";
        document.getElementById('facture_sujet').value = d.sujet || "";

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

/* ==========================================================================
   GENERATION PDF (CENTRÉ & COLONNES)
   ========================================================================== */

window.genererPDFFacture = function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const type = getVal('doc_type');
    const numero = getVal('facture_numero');

    // LOGO
    const imgElement = document.getElementById('logo-source');
    if (imgElement && imgElement.naturalWidth > 0) pdf.addImage(imgElement, 'PNG', 15, 15, 35, 35);
    
    // Header Société
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52); 
    pdf.text("POMPES FUNEBRES", 15, 55);
    pdf.text("SOLIDAIRE PERPIGNAN", 15, 60);
    
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("32 boulevard Léon Jean Grégory Thuir - FRANCE", 15, 66);
    pdf.text("pfsolidaireperpignan@gmail.com", 15, 70);
    pdf.text("SIRET : 539 270 298 00042", 15, 74);
    pdf.text("Tél : +33 7 55 18 27 77", 15, 78);

    // Client
    pdf.setFillColor(240, 240, 240); 
    pdf.rect(120, 20, 75, 40, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("Famille", 125, 28);
    pdf.setFont("helvetica", "normal");
    pdf.text(getVal('facture_nom'), 125, 35);
    const adresse = pdf.splitTextToSize(getVal('facture_adresse'), 70);
    pdf.text(adresse, 125, 42);

    // Titre Centré
    let y = 90;
    const sujet = getVal('facture_sujet').toUpperCase();
    if(sujet) {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(sujet, 15, y);
        y += 10;
    }
    
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(22, 101, 52);
    let dateFr = getVal('facture_date');
    if(dateFr.includes('-')) dateFr = dateFr.split('-').reverse().join('-');
    pdf.text(`${type} N° ${numero} du ${dateFr}`, 105, y, {align:"center"});
    y += 10;

    // PREPARATION TABLEAU
    const rows = [];
    document.querySelectorAll('#lines-body tr').forEach(row => {
        const desc = row.querySelector('.l-desc') ? row.querySelector('.l-desc').value : "";
        if (row.dataset.type === 'section') {
            rows.push([{
                content: desc, 
                colSpan: 4, 
                styles: {fillColor: [255, 237, 213], textColor: [0,0,0], fontStyle: 'bold'}
            }]);
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

    // TABLEAU AUTO (CENTRAGE COLONNES)
    pdf.autoTable({
        startY: 100,
        head: [['', 'TVA', 'PRIX TTC PRESTATIONS\nCOURANTES', 'PRIX TTC PRESTATIONS\nCOMPLEMENTAIRES\nOPTIONNELLES']],
        body: rows,
        theme: 'grid',
        headStyles: { 
            fillColor: [220, 252, 231], textColor: [22, 101, 52], lineColor: [100, 100, 100], 
            lineWidth: 0.1, halign: 'center', valign: 'middle'
        },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, valign: 'middle' },
        columnStyles: { 
            0: { cellWidth: 90 }, 
            1: { cellWidth: 15, halign: 'center' },
            2: { cellWidth: 40, halign: 'right' },
            3: { cellWidth: 40, halign: 'right' }
        }
    });

    // TOTAL
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
